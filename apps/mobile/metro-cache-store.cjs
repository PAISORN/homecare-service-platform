// Metro can request thousands of cache entries at once while building a graph.
// Bound filesystem operations independently of transform worker concurrency.
class BoundedCacheStore {
  constructor(store, limit = 32) {
    this.store = store;
    this.limit = limit;
    this.active = 0;
    this.queue = [];
  }

  async run(operation) {
    if (this.active >= this.limit) {
      await new Promise((resolve) => this.queue.push(resolve));
    } else {
      this.active += 1;
    }
    try {
      return await operation();
    } finally {
      const next = this.queue.shift();
      if (next) next();
      else this.active -= 1;
    }
  }

  get(key) {
    return this.run(() => this.store.get(key));
  }

  set(key, value) {
    return this.run(() => this.store.set(key, value));
  }

  clear() {
    return this.store.clear();
  }
}

module.exports = { BoundedCacheStore };
