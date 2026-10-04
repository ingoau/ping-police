// Tracks keys that are on cooldown until an expiry time. Expired entries are
// swept whenever a new cooldown starts, so the map only ever holds live ones.
export class Cooldowns {
  #expiries = new Map<string, number>();

  constructor(private ttlMs: number) {}

  isActive(key: string, now = Date.now()) {
    const expiry = this.#expiries.get(key);
    return expiry !== undefined && expiry > now;
  }

  start(key: string, now = Date.now()) {
    this.sweep(now);
    this.#expiries.set(key, now + this.ttlMs);
  }

  sweep(now = Date.now()) {
    for (const [key, expiry] of this.#expiries) {
      if (expiry <= now) this.#expiries.delete(key);
    }
  }

  get size() {
    return this.#expiries.size;
  }
}
