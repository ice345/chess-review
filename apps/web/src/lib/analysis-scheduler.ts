export type AnalysisJobPriority = "interactive-position" | "interactive-variation" | "background-game";

const PRIORITY_ORDER: Record<AnalysisJobPriority, number> = {
  "interactive-position": 0,
  "interactive-variation": 1,
  "background-game": 2,
};

interface QueuedJob<T> {
  priority: AnalysisJobPriority;
  sequence: number;
  task: () => Promise<T>;
  signal?: AbortSignal;
  started: boolean;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
  removeAbortListener: () => void;
}

function abortError(): Error {
  const error = new Error("Analysis job was cancelled before it could run.");
  error.name = "AbortError";
  return error;
}

/**
 * A deliberately small in-browser resource policy. It bounds concurrently
 * active analysis jobs and chooses current-position work before variations,
 * then background game review. Two background jobs may run together so a
 * history import is not needlessly serial; the total engine-task capacity is
 * still bounded, and interactive work keeps the higher queue priority.
 */
export class AnalysisScheduler {
  private active = 0;
  private activeBackground = 0;
  private sequence = 0;
  private readonly queue: Array<QueuedJob<unknown>> = [];

  constructor(
    readonly capacity = 2,
    readonly backgroundCapacity = Math.min(2, capacity),
  ) {
    if (!Number.isInteger(capacity) || capacity < 1) throw new Error("Analysis scheduler capacity must be positive.");
    if (!Number.isInteger(backgroundCapacity) || backgroundCapacity < 1 || backgroundCapacity > capacity) {
      throw new Error("Background analysis capacity must be between one and the scheduler capacity.");
    }
  }

  run<T>(priority: AnalysisJobPriority, task: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    if (signal?.aborted) return Promise.reject(abortError());
    return new Promise<T>((resolve, reject) => {
      const job: QueuedJob<T> = {
        priority,
        sequence: this.sequence++,
        task,
        ...(signal === undefined ? {} : { signal }),
        started: false,
        resolve,
        reject,
        removeAbortListener: () => undefined,
      };
      const onAbort = () => {
        if (job.started) return;
        const index = this.queue.indexOf(job as QueuedJob<unknown>);
        if (index >= 0) this.queue.splice(index, 1);
        job.removeAbortListener();
        reject(abortError());
      };
      signal?.addEventListener("abort", onAbort, { once: true });
      job.removeAbortListener = () => signal?.removeEventListener("abort", onAbort);
      this.queue.push(job as QueuedJob<unknown>);
      this.drain();
    });
  }

  get pendingCount(): number {
    return this.queue.length;
  }

  get activeCount(): number {
    return this.active;
  }

  private drain(): void {
    this.queue.sort((left, right) => (
      PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority]
      || left.sequence - right.sequence
    ));
    while (this.active < this.capacity) {
      const nextIndex = this.queue.findIndex((candidate) => (
        candidate.priority !== "background-game" || this.activeBackground < this.backgroundCapacity
      ));
      if (nextIndex < 0) return;
      const [job] = this.queue.splice(nextIndex, 1);
      if (!job) return;
      if (job.signal?.aborted) {
        job.removeAbortListener();
        job.reject(abortError());
        continue;
      }
      job.started = true;
      job.removeAbortListener();
      this.active += 1;
      if (job.priority === "background-game") this.activeBackground += 1;
      void job.task().then(job.resolve, job.reject).finally(() => {
        this.active -= 1;
        if (job.priority === "background-game") this.activeBackground -= 1;
        this.drain();
      });
    }
  }
}

export const analysisScheduler = new AnalysisScheduler(2, 2);
