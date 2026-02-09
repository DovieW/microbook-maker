class JobQueueService {
  constructor({ concurrency = 1 } = {}) {
    this.concurrency = Math.max(1, Number(concurrency) || 1);
    this.running = 0;
    this.queue = [];
    this.idleResolvers = [];
  }

  enqueue(id, handler) {
    if (typeof handler !== 'function') {
      throw new Error('Queue handler must be a function');
    }

    this.queue.push({ id, handler });
    this.#processQueue();
  }

  remove(id) {
    const before = this.queue.length;
    this.queue = this.queue.filter((job) => job.id !== id);
    return this.queue.length !== before;
  }

  isQueued(id) {
    return this.queue.some((job) => job.id === id);
  }

  getSnapshot() {
    return {
      running: this.running,
      queued: this.queue.map((job) => job.id),
      concurrency: this.concurrency,
    };
  }

  async onIdle() {
    if (this.running === 0 && this.queue.length === 0) {
      return;
    }

    await new Promise(resolve => {
      this.idleResolvers.push(resolve);
    });
  }

  #notifyIdleIfNeeded() {
    if (this.running !== 0 || this.queue.length !== 0) {
      return;
    }

    while (this.idleResolvers.length > 0) {
      const resolve = this.idleResolvers.shift();
      resolve();
    }
  }

  #processQueue() {
    while (this.running < this.concurrency && this.queue.length > 0) {
      const next = this.queue.shift();
      this.running += 1;

      Promise.resolve()
        .then(() => next.handler())
        .catch((error) => {
          console.error(`Queued job failed (${next.id}):`, error);
        })
        .finally(() => {
          this.running -= 1;
          this.#processQueue();
          this.#notifyIdleIfNeeded();
        });
    }

    this.#notifyIdleIfNeeded();
  }
}

module.exports = {
  JobQueueService,
};
