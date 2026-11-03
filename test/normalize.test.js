import test from "node:test";
import assert from "node:assert/strict";
import { normalizeFeed } from "../src/normalize.js";

test("normalizes events and bookmaker odds with provider-scoped IDs", () => {
  const result = normalizeFeed({
    events: [{ id: "e1", home: "Alpha", away: "Beta", startTime: "2026-12-01T18:00:00Z" }],
    odds: [{ eventId: "e1", market: "1X2", selection: "home", odds: "2.2" }]
  }, "fonbet");

  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].id, "fonbet:e1");
  assert.equal(result.odds.length, 1);
  assert.equal(result.odds[0].eventId, "fonbet:e1");
  assert.equal(result.odds[0].odds, 2.2);
});

test("rejects incomplete events and invalid prices", () => {
  const result = normalizeFeed({
    events: [{ id: "missing-teams" }, { id: "ok", home: "A", away: "B" }],
    odds: [
      { eventId: "ok", market: "winner", selection: "A", odds: 1 },
      { eventId: "ok", market: "winner", selection: "B", odds: 2 }
    ]
  }, "winline");

  assert.equal(result.events.length, 1);
  assert.equal(result.odds.length, 1);
});

test("parses string suspension flags without treating false as true", () => {
  const result = normalizeFeed({
    events: [],
    odds: [
      { eventId: "e1", market: "total", selection: "over", odds: 1.8, suspended: "false" },
      { eventId: "e1", market: "total", selection: "under", odds: 2.1, suspended: "true" }
    ]
  }, "fonbet");

  assert.equal(result.odds[0].suspended, false);
  assert.equal(result.odds[1].suspended, true);
});
