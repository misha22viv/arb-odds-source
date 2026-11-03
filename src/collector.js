import { normalizeFeed } from "./normalize.js";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class Collector {
  constructor({ providers, store, timeoutMs = 8000, onStatus = () => {} }) {
    this.providers = providers;
    this.store = store;
    this.timeoutMs = timeoutMs;
    this.onStatus = onStatus;
    this.status = Object.fromEntries(providers.map((p) => [p.id, {
      provider: p.id,
      enabled: p.enabled,
      state: p.enabled ? (p.url ? "never_polled" : "not_configured") : "disabled",
      lastAttemptAt: null,
      lastSuccessAt: null,
      lastError: null,
      eventCount: 0,
      oddsCount: 0
    }]));
    this.running = false;
  }

  getStatus() { return Object.values(this.status); }

  async pollOne(provider) {
    const status = this.status[provider.id];
    if (!provider.enabled || !provider.url) return;
    status.lastAttemptAt = new Date().toISOString();
    this.onStatus(this.getStatus());

    let lastError;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await fetch(provider.url, {
          headers: { accept: "application/json", "user-agent": "arb-odds-source/0.1" },
          signal: controller.signal
        });
        if (!response.ok) throw new Error(`Feed returned HTTP ${response.status}`);
        const payload = await response.json();
        const normalized = normalizeFeed(payload, provider.id);
        const counts = await this.store.ingest(provider.id, normalized);
        Object.assign(status, {
          state: "ok",
          lastSuccessAt: new Date().toISOString(),
          lastError: null,
          eventCount: counts.events,
          oddsCount: counts.odds
        });
        this.onStatus(this.getStatus());
        return;
      } catch (error) {
        lastError = error;
        if (attempt < 2) await sleep(500 * (2 ** attempt));
      } finally {
        clearTimeout(timer);
      }
    }
    status.state = "error";
    status.lastError = lastError?.name === "AbortError" ? "Feed request timed out" : String(lastError?.message || lastError);
    this.onStatus(this.getStatus());
  }

  async pollAll() {
    await Promise.all(this.providers.map((provider) => this.pollOne(provider)));
  }

  async start(intervalMs) {
    if (this.running) return;
    this.running = true;
    while (this.running) {
      await this.pollAll();
      await sleep(intervalMs);
    }
  }

  stop() { this.running = false; }
}
