import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { containsUnsafeText } from '@kia./shared';
import {
  assertDepartmentEnabled,
  describeConference,
  EventBusService,
  PrismaService,
} from '@kia./platform';

function clean(value: string, max: number): string {
  const text = value.trim();
  if (!text || text.length > max || containsUnsafeText(text)) throw new BadRequestException('Invalid text');
  return text;
}

function slugify(title: string): string {
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
  return `${base || 'event'}-${randomBytes(3).toString('hex')}`;
}

@Injectable()
export class LiveEventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventBusService,
  ) {}

  private gate() {
    return assertDepartmentEnabled(this.prisma, 'events');
  }

  async list() {
    await this.gate();
    return this.prisma.liveEvent.findMany({
      where: { published: true },
      orderBy: { startsAt: 'asc' },
      include: { tickets: true, _count: { select: { signups: true } } },
    });
  }

  async get(slug: string) {
    await this.gate();
    const event = await this.prisma.liveEvent.findFirst({
      where: { slug, published: true },
      include: { tickets: true, speakers: true, agenda: true },
    });
    if (!event) throw new NotFoundException('Event not found');
    return { ...event, conference: describeConference(event.joinUrl) };
  }

  async create(organizerId: string, input: Record<string, unknown>) {
    await this.gate();
    const title = clean(String(input.title ?? ''), 160);
    const isFree = input.isFree !== false;
    const priceIrr = isFree ? 0 : Math.max(0, Math.floor(Number(input.priceIrr) || 0));
    return this.prisma.liveEvent.create({
      data: {
        organizerId,
        slug: slugify(title),
        title,
        category: clean(String(input.category ?? 'general'), 60),
        startsAt: new Date(String(input.startsAt ?? '')),
        endsAt: input.endsAt ? new Date(String(input.endsAt)) : null,
        timezone: String(input.timezone ?? 'Asia/Tehran').slice(0, 60),
        venue: input.venue ? clean(String(input.venue), 200) : '',
        capacity: Math.max(0, Math.floor(Number(input.capacity) || 0)),
        published: Boolean(input.published),
        isFree,
        priceIrr,
        rules: input.rules ? clean(String(input.rules), 4000) : '',
        joinUrl: typeof input.joinUrl === 'string' ? input.joinUrl.slice(0, 500) : null,
        provider: input.joinUrl ? 'link' : 'unconfigured',
      },
    });
  }

  async addTicket(actorId: string, eventId: string, input: { name: string; priceIrr?: number; capacity?: number }) {
    await this.gate();
    await this.assertOrganizer(actorId, eventId);
    return this.prisma.eventTicketType.create({
      data: {
        eventId,
        name: clean(input.name, 80),
        priceIrr: Math.max(0, Math.floor(input.priceIrr ?? 0)),
        capacity: Math.max(0, Math.floor(input.capacity ?? 0)),
      },
    });
  }

  async addSpeaker(actorId: string, eventId: string, input: { name: string; bio?: string }) {
    await this.gate();
    await this.assertOrganizer(actorId, eventId);
    return this.prisma.eventSpeaker.create({
      data: { eventId, name: clean(input.name, 80), bio: input.bio ? clean(input.bio, 1000) : '' },
    });
  }

  async addAgenda(actorId: string, eventId: string, input: { title: string; startsAt: string; endsAt?: string }) {
    await this.gate();
    await this.assertOrganizer(actorId, eventId);
    return this.prisma.eventAgendaItem.create({
      data: {
        eventId,
        title: clean(input.title, 160),
        startsAt: new Date(input.startsAt),
        endsAt: input.endsAt ? new Date(input.endsAt) : null,
      },
    });
  }

  async register(userId: string, eventId: string, ticketTypeId?: string) {
    await this.gate();
    const event = await this.prisma.liveEvent.findFirst({
      where: { published: true, OR: [{ id: eventId }, { slug: eventId }] },
      include: { tickets: true, _count: { select: { signups: true } } },
    });
    if (!event) throw new NotFoundException('Event not found');
    const eventIdResolved = event.id;
    const approved = await this.prisma.eventSignup.count({
      where: { eventId: eventIdResolved, status: { in: ['approved', 'checked_in', 'pending'] } },
    });
    if (event.capacity > 0 && approved >= event.capacity) {
      return this.prisma.eventSignup.create({
        data: {
          eventId: eventIdResolved,
          userId,
          ticketTypeId: ticketTypeId || null,
          status: 'waitlist',
          code: randomBytes(6).toString('hex'),
        },
      });
    }
    if (!event.isFree && event.priceIrr > 0) {
      const paid = await this.prisma.departmentInvoice.findFirst({
        where: { userId, department: 'events', resourceId: eventIdResolved, status: 'paid' },
      });
      if (!paid) {
        const invoice = await this.prisma.departmentInvoice.create({
          data: {
            userId,
            department: 'events',
            resourceType: 'event-ticket',
            resourceId: eventIdResolved,
            title: event.title,
            amountIrr: event.priceIrr,
            status: 'pending',
          },
        });
        return { paymentRequired: true, invoice };
      }
    }
    try {
      const signup = await this.prisma.eventSignup.create({
        data: {
          eventId: eventIdResolved,
          userId,
          ticketTypeId: ticketTypeId || null,
          status: 'approved',
          code: randomBytes(6).toString('hex'),
        },
      });
      await this.events.publish({
        name: 'events.live.registered',
        occurredAt: new Date().toISOString(),
        userId,
        eventId: eventIdResolved,
        dedupeKey: `live-reg:${eventIdResolved}:${userId}`,
      });
      return signup;
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') throw new ConflictException('Already registered');
      throw error;
    }
  }

  async cancel(userId: string, eventId: string) {
    await this.gate();
    const signup = await this.prisma.eventSignup.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });
    if (!signup) throw new NotFoundException('Registration not found');
    return this.prisma.eventSignup.update({ where: { id: signup.id }, data: { status: 'cancelled' } });
  }

  async approve(actorId: string, signupId: string) {
    await this.gate();
    const signup = await this.prisma.eventSignup.findUnique({ where: { id: signupId } });
    if (!signup) throw new NotFoundException('Registration not found');
    await this.assertOrganizer(actorId, signup.eventId);
    return this.prisma.eventSignup.update({ where: { id: signupId }, data: { status: 'approved' } });
  }

  async checkIn(actorId: string, code: string) {
    await this.gate();
    const signup = await this.prisma.eventSignup.findUnique({ where: { code } });
    if (!signup) throw new NotFoundException('Ticket not found');
    await this.assertOrganizer(actorId, signup.eventId);
    if (signup.status === 'cancelled') throw new BadRequestException('Ticket cancelled');
    return this.prisma.eventSignup.update({ where: { id: signup.id }, data: { status: 'checked_in' } });
  }

  async mine(userId: string) {
    await this.gate();
    return this.prisma.eventSignup.findMany({
      where: { userId },
      include: { event: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async assertOrganizer(actorId: string, eventId: string) {
    const event = await this.prisma.liveEvent.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    if (event.organizerId === actorId) return event;
    const role = await this.prisma.departmentMembership.findFirst({
      where: { userId: actorId, department: 'events', role: { in: ['EVENTS_ADMIN', 'ORGANIZER'] } },
    });
    if (!role) throw new ForbiddenException('Insufficient permissions');
    return event;
  }
}
