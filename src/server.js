import { createServer } from "node:http";
import { resolve } from "node:path";
import { Store } from "./store.js";
import { Collector } from "./collector.js";

const env = process.env;
const port = Number(env.PORT || 8787);
const host = env.HOST || "0.0.0.0";
const intervalMs = Math.max(5000, Number(env.POLL_INTERVAL_MS || 15000));
const timeoutMs = Math.max(1000, Number(env.REQUEST_TIMEOUT_MS || 8000));
const dataDir = resolve(env.DATA_DIR || "./data");
const providers = [
  { id: "fonbet", enabled: env.FONBET_ENABLED === "true", url: env.FONBET_FEED_URL || "" },
  { id: "winline", enabled: env.WINLINE_ENABLED === "true", url: env.WINLINE_FEED_URL || "" }
];

const store = new Store(dataDir, Number(env.MAX_HISTORY_ROWS || 100000));
await store.init();
const collector = new Collector({ providers, store, timeoutMs, staleAfterMs: intervalMs * 3 });
const json = (res, status, body) => {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": "*"
  });
  res.end(JSON.stringify(body));
};

const server = createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const provider = url.searchParams.get("provider") || undefined;
  const eventId = url.searchParams.get("eventId") || undefined;
  const limitRaw = Number(url.searchParams.get("limit") || 1000);
  const limit = Math.min(5000, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 1000));

  if (req.method !== "GET") return json(res, 405, { error: "method_not_allowed" });
  if (url.pathname === "/health") {
    const states = collector.getStatus();
    return json(res, 200, {
      service: "arb-odds-source",
      status: states.some((s) => s.state === "ok") ? "ok" : "waiting_for_authorized_feed",
      providers: states,
      timestamp: new Date().toISOString()
    });
  }
  if (url.pathname === "/api/v1/providers") return json(res, 200, { providers: collector.getStatus() });
  if (url.pathname === "/api/v1/events") return json(res, 200, { events: store.events(provider) });
  if (url.pathname === "/api/v1/odds") {
    const since = url.searchParams.get("since") || undefined;
    if (since && !Number.isFinite(Date.parse(since))) return json(res, 400, { error: "invalid_since_timestamp" });
    return json(res, 200, { odds: store.odds({ provider, eventId, since, limit }) });
  }
  if (url.pathname === "/api/v1/history") return json(res, 200, { history: store.history({ provider, eventId, limit }) });
  return json(res, 404, { error: "not_found" });
});

server.listen(port, host, () => {
  console.log(`arb-odds-source listening on http://${host}:${port}`);
  void collector.start(intervalMs);
});

const shutdown = () => {
  collector.stop();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
