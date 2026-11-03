import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

const emptyState = () => ({ version: 1, events: {}, latestOdds: {}, history: [] });

export class Store {
  constructor(directory, maxHistoryRows = 100000) {
    this.directory = directory;
    this.file = join(directory, "odds-store.json");
    this.maxHistoryRows = maxHistoryRows;
    this.state = emptyState();
    this.writeQueue = Promise.resolve();
  }

  async init() {
    await mkdir(this.directory, { recursive: true });
    try {
      const parsed = JSON.parse(await readFile(this.file, "utf8"));
      if (parsed?.version === 1) this.state = { ...emptyState(), ...parsed };
    } catch (error) {
      if (error.code !== "ENOENT") throw new Error(`Cannot read store: ${error.message}`);
    }
  }

  async ingest(provider, normalized) {
    const now = new Date().toISOString();
    for (const event of normalized.events) {
      this.state.events[event.id] = { ...event, updatedAt: now };
    }
    for (const row of normalized.odds) {
      const snapshot = { ...row, observedAt: now };
      this.state.latestOdds[row.id] = snapshot;
      this.state.history.push(snapshot);
    }
    if (this.state.history.length > this.maxHistoryRows) {
      this.state.history.splice(0, this.state.history.length - this.maxHistoryRows);
    }
    await this.persist();
    return { events: normalized.events.length, odds: normalized.odds.length };
  }

  persist() {
    this.writeQueue = this.writeQueue.then(async () => {
      const temp = `${this.file}.tmp`;
      await writeFile(temp, JSON.stringify(this.state), "utf8");
      await rename(temp, this.file);
    });
    return this.writeQueue;
  }

  events(provider) {
    return Object.values(this.state.events).filter((row) => !provider || row.provider === provider);
  }

  odds({ provider, eventId, since, limit = 1000 } = {}) {
    const sinceMs = since ? Date.parse(since) : 0;
    return Object.values(this.state.latestOdds)
      .filter((row) => (!provider || row.provider === provider) && (!eventId || row.eventId === eventId)
        && (!since || Date.parse(row.observedAt) >= sinceMs))
      .sort((a, b) => b.observedAt.localeCompare(a.observedAt))
      .slice(0, limit);
  }

  history({ provider, eventId, limit = 1000 } = {}) {
    return this.state.history
      .filter((row) => (!provider || row.provider === provider) && (!eventId || row.eventId === eventId))
      .slice(-limit).reverse();
  }
}
