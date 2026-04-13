interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  fetchedAt: number;
}

export class MemoryCache<T> {
  private entry: CacheEntry<T> | null = null;

  constructor(
    private readonly ttlMs: number,
    private readonly fetcher: () => Promise<T>,
    private readonly label: string,
  ) {}

  async get(): Promise<T | null> {
    const now = Date.now();

    if (this.entry && now < this.entry.expiresAt) {
      return this.entry.data;
    }

    try {
      const data = await this.fetcher();
      this.entry = {
        data,
        expiresAt: now + this.ttlMs,
        fetchedAt: now,
      };
      return data;
    } catch (error) {
      console.error(`[cache:${this.label}] fetch failed`, error);

      if (this.entry) {
        console.warn(
          `[cache:${this.label}] using stale cache from ${new Date(this.entry.fetchedAt).toISOString()}`,
        );
        return this.entry.data;
      }

      return null;
    }
  }

  async refresh(): Promise<T | null> {
    this.entry = null;
    return this.get();
  }
}
