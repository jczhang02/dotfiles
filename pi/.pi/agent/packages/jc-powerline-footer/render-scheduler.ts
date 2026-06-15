export interface RenderScheduler {
  schedule(delayMs?: number): void;
  cancel(): void;
}

export function createRenderScheduler(render: () => void, defaultDelayMs: number): RenderScheduler {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let scheduledAt = 0;

  return {
    schedule(delayMs = defaultDelayMs) {
      const nextScheduledAt = Date.now() + delayMs;
      if (timer) {
        if (scheduledAt <= nextScheduledAt) return;
        clearTimeout(timer);
        timer = null;
      }
      scheduledAt = nextScheduledAt;

      timer = setTimeout(() => {
        timer = null;
        scheduledAt = 0;
        render();
      }, delayMs);
    },
    cancel() {
      if (!timer) return;
      clearTimeout(timer);
      timer = null;
      scheduledAt = 0;
    },
  };
}
