import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '@kia./platform';
import { MotionService } from './motion.service';

@Injectable()
export class MotionJobRunner implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;
  private busy = false;
  private readonly signals = new Map<string, AbortController>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly motion: MotionService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.tick();
    }, 2000);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    for (const controller of this.signals.values()) controller.abort();
  }

  abort(jobId: string): void {
    this.signals.get(jobId)?.abort();
  }

  private async tick(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const runningRender = await this.prisma.motionJob.count({
        where: { status: 'RUNNING', kind: 'render' },
      });
      const job = await this.prisma.motionJob.findFirst({
        where: {
          status: 'QUEUED',
          ...(runningRender > 0 ? { kind: { not: 'render' } } : {}),
        },
        orderBy: { createdAt: 'asc' },
      });
      if (!job) return;
      const claimed = await this.prisma.motionJob.updateMany({
        where: { id: job.id, status: 'QUEUED', cancelRequested: false },
        data: { status: 'RUNNING', startedAt: new Date(), attempts: { increment: 1 } },
      });
      if (claimed.count !== 1) return;
      const controller = new AbortController();
      this.signals.set(job.id, controller);
      try {
        if (job.kind === 'analyze') await this.motion.runAnalyzeJob(job.id);
        else if (job.kind === 'render') await this.motion.runRenderJob(job.id, controller.signal);
        else if (job.kind === 'cleanup') await this.motion.runCleanupJob(job.id);
        else throw new Error(`Unknown motion job kind ${job.kind}`);
      } catch (error) {
        await this.motion.failJob(job.id, error);
      } finally {
        this.signals.delete(job.id);
      }
    } finally {
      this.busy = false;
    }
  }
}
