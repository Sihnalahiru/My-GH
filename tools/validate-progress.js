/* BUILD-12 — Progress State Validator */
"use strict";

const fs = require("fs");
const path = require("path");
const {
  SCHEMA_VERSION,
  EVENT_TYPES,
  normalizeState,
  normalizeEvent,
  normalizeSession
} = require(path.join(__dirname, "..", "app", "progress.js"));

const ROOT = path.join(__dirname, "..");
const schema = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "progress-schema.json"), "utf8"));

const errors = [];
const warnings = [];

function err(code, message) { errors.push(`${code}: ${message}`); }
function warn(code, message) { warnings.push(`${code}: ${message}`); }

if (!schema || schema.title !== "SSW Airport Ground Handling Learner Progress State") {
  err("PROG-001", "progress schema missing or unexpected");
}

const state = normalizeState({ schema_version: SCHEMA_VERSION, events: [], sessions: [] });
if (state.schema_version !== SCHEMA_VERSION) err("PROG-002", "schema version normalization failed");
if (!Array.isArray(state.events)) err("PROG-003", "events must be an array");
if (!Array.isArray(state.sessions)) err("PROG-004", "sessions must be an array");

for (const type of Object.values(EVENT_TYPES)) {
  if (!type) err("PROG-005", "empty event type detected");
}

const sampleEvent = normalizeEvent({
  event_id: "evt-test",
  type: EVENT_TYPES.MCQ_ANSWER,
  occurred_at: "2026-09-27T00:00:00.000Z",
  question_id: "GH01-SBP-Q001",
  topic_id: "GH01-T001",
  correct: true,
  duration_seconds: 4
});
if (sampleEvent.type !== EVENT_TYPES.MCQ_ANSWER || sampleEvent.correct !== true) {
  err("PROG-006", "event normalization failed");
}

const sampleSession = normalizeSession({
  session_id: "session-test",
  session_type: "mcq",
  total: 10,
  answered: 10,
  correct: 8,
  incorrect: 2,
  score_percent: 80
});
if (sampleSession.score_percent !== 80) err("PROG-007", "session normalization failed");
if (sampleSession.correct + sampleSession.incorrect > sampleSession.answered) {
  err("PROG-008", "session correctness totals exceed answered count");
}

warn("PROG-W001", "Learner progress is runtime/local state, not source/master study data.");
warn("PROG-W002", "No populated learner history is bundled in the repository.");

const report = {
  build: "BUILD-12",
  component: "Progress / Analytics",
  status: errors.length ? "FAILED" : "VERIFIED",
  schema_version: SCHEMA_VERSION,
  errors,
  warnings,
  checks: {
    schema_present: true,
    state_normalization: errors.every(e => !e.startsWith("PROG-002") && !e.startsWith("PROG-003") && !e.startsWith("PROG-004")),
    event_types: Object.values(EVENT_TYPES).length,
    sample_event: sampleEvent,
    sample_session: sampleSession
  }
};

console.log(JSON.stringify(report, null, 2));
process.exitCode = errors.length ? 1 : 0;
