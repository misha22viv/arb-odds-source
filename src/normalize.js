const first = (...values) => values.find((value) => value !== undefined && value !== null && value !== "");

const asText = (value) => value === undefined || value === null ? "" : String(value).trim();

export function normalizeEvent(raw, provider) {
  if (!raw || typeof raw !== "object") return null;
  const sourceId = asText(first(raw.id, raw.eventId, raw.event_id, raw.matchId, raw.match_id, raw.slug));
  const home = asText(first(raw.home, raw.homeTeam, raw.home_team, raw.team1, raw.player1));
  const away = asText(first(raw.away, raw.awayTeam, raw.away_team, raw.team2, raw.player2));
  if (!sourceId || !home || !away) return null;

  const startRaw = first(raw.startTime, raw.start_time, raw.start, raw.startsAt, raw.date, raw.timestamp);
  const parsed = startRaw === undefined ? null : new Date(startRaw);
  const startTime = parsed && Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;

  return {
    id: `${provider}:${sourceId}`,
    sourceId,
    provider,
    sport: asText(first(raw.sport, raw.sportName, raw.sport_name, raw.category)) || "unknown",
    league: asText(first(raw.league, raw.competition, raw.tournament)) || null,
    home,
    away,
    startTime,
    status: asText(first(raw.status, raw.eventStatus)) || "unknown",
    updatedAt: new Date().toISOString()
  };
}

export function normalizeOdds(raw, provider) {
  if (!raw || typeof raw !== "object") return null;
  const sourceEventId = asText(first(raw.eventId, raw.event_id, raw.matchId, raw.match_id, raw.event?.id));
  const market = asText(first(raw.market, raw.marketName, raw.market_name, raw.marketKey, raw.market_key));
  const selection = asText(first(raw.selection, raw.outcome, raw.runner, raw.name, raw.label));
  const price = Number(first(raw.odds, raw.price, raw.coefficient, raw.value));
  if (!sourceEventId || !market || !selection || !Number.isFinite(price) || price <= 1) return null;

  const observedAt = new Date().toISOString();
  return {
    id: `${provider}:${sourceEventId}:${market}:${selection}`,
    provider,
    eventId: `${provider}:${sourceEventId}`,
    sourceEventId,
    market,
    selection,
    odds: price,
    suspended: Boolean(first(raw.suspended, raw.isSuspended, raw.is_suspended, false)),
    observedAt
  };
}

export function normalizeFeed(payload, provider) {
  if (!payload || typeof payload !== "object") {
    throw new TypeError("Feed response must be a JSON object");
  }
  const eventsIn = Array.isArray(payload.events) ? payload.events : [];
  const oddsIn = Array.isArray(payload.odds) ? payload.odds
    : Array.isArray(payload.outcomes) ? payload.outcomes
    : Array.isArray(payload.selections) ? payload.selections : [];

  return {
    events: eventsIn.map((row) => normalizeEvent(row, provider)).filter(Boolean),
    odds: oddsIn.map((row) => normalizeOdds(row, provider)).filter(Boolean)
  };
}
