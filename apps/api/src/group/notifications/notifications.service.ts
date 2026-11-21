import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { EventBusService, PrismaService } from '@kia./platform';

@Injectable()
export class NotificationsService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventBusService,
  ) {}

  onModuleInit() {
    this.events.on('academy.certificate.issued', (event) =>
      this.push(event.userId, 'گواهی صادر شد', 'گواهی دوره شما آماده است.', '/academy/practice', 'academy'),
    );
    this.events.on('events.live.registered', (event) =>
      this.push(event.userId, 'ثبت‌نام رویداد', 'ثبت‌نام شما ثبت شد.', '/events/live', 'events'),
    );
    this.events.on('group.payment.completed', (event) =>
      this.push(event.userId, 'پرداخت', 'پرداخت شما ثبت شد.', '/dashboard/finance', 'group'),
    );
  }

  list(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async read(userId: string, id: string) {
    const row = await this.prisma.notification.findFirst({ where: { id, userId } });
    if (!row) throw new NotFoundException('Notification not found');
    return this.prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
  }

  private async push(userId: string, title: string, body: string, href: string, department: string) {
    await this.prisma.notification.create({ data: { userId, title, body, href, department } });
  }
}
