/* BUILD-12 — Progress / Analytics Engine
 *
 * Learner-state layer only.
 * IMPORTANT: this module never mutates source/master JSON.
 * It records learner activity separately and derives analytics from those records.
 */
(function () {
  "use strict";

  const SCHEMA_VERSION = 1;
  const STORAGE_KEY = "ssw-gh-progress-v1";
  const MAX_EVENT_HISTORY = 5000;

  const EVENT_TYPES = Object.freeze({
    STUDY_OPEN: "STUDY_OPEN",
    STUDY_COMPLETE: "STUDY_COMPLETE",
    MCQ_ANSWER: "MCQ_ANSWER",
    EXAM_COMPLETE: "EXAM_COMPLETE",
    VISUAL_VIEW: "VISUAL_VIEW",
    GLOSSARY_VIEW: "GLOSSARY_VIEW",
    AUDIO_PLAY: "AUDIO_PLAY",
    EXAM_START: "EXAM_START",
    EXAM_ANSWER: "EXAM_ANSWER",
    EXAM_ABANDON: "EXAM_ABANDON"
  });

  function nowIso() {
    return new Date().toISOString();
  }

  function safeText(value) {
    return value == null ? "" : String(value);
  }

  function nonNegativeInt(value) {
    const n = Number(value);
    return Number.isInteger(n) && n >= 0 ? n : 0;
  }

  function clamp01(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.min(1, Math.max(0, n));
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function dateKey(date = new Date()) {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  }

  function weekKey(date = new Date()) {
    const d = date instanceof Date ? new Date(date) : new Date(date);
    if (Number.isNaN(d.getTime())) return null;
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
  }

  function createEmptyState() {
    return {
      schema_version: SCHEMA_VERSION,
      created_at: nowIso(),
      updated_at: nowIso(),
      events: [],
      sessions: [],
      settings: {
        streak_timezone: "UTC"
      }
    };
  }

  function normalizeState(input) {
    const source = input && typeof input === "object" ? input : {};
    const state = createEmptyState();
    state.schema_version = Number.isInteger(source.schema_version)
      ? source.schema_version
      : SCHEMA_VERSION;
    state.created_at = source.created_at || state.created_at;
    state.updated_at = source.updated_at || state.updated_at;
    state.events = Array.isArray(source.events)
      ? source.events.filter(e => e && typeof e === "object").map(normalizeEvent)
      : [];
    state.sessions = Array.isArray(source.sessions)
      ? source.sessions.filter(s => s && typeof s === "object").map(normalizeSession)
      : [];
    state.settings = {
      ...state.settings,
      ...(source.settings && typeof source.settings === "object" ? source.settings : {})
    };
    return state;
  }

  function normalizeEvent(event) {
    return {
      event_id: safeText(event.event_id),
      type: safeText(event.type),
      occurred_at: event.occurred_at || nowIso(),
      source: safeText(event.source),
      track: safeText(event.track),
      source_id: safeText(event.source_id),
      physical_page: Number.isInteger(event.physical_page) ? event.physical_page : null,
      chapter_id: safeText(event.chapter_id),
      topic_id: safeText(event.topic_id),
      fact_id: safeText(event.fact_id),
      study_id: safeText(event.study_id),
      question_id: safeText(event.question_id),
      visual_id: safeText(event.visual_id),
      term_id: safeText(event.term_id),
      correct: typeof event.correct === "boolean" ? event.correct : null,
      result: safeText(event.result),
      duration_seconds: Number.isFinite(event.duration_seconds)
        ? Math.max(0, Number(event.duration_seconds))
        : 0,
      metadata: event.metadata && typeof event.metadata === "object"
        ? clone(event.metadata)
        : {}
    };
  }

  function normalizeSession(session) {
    return {
      session_id: safeText(session.session_id),
      session_type: safeText(session.session_type),
      started_at: session.started_at || null,
      completed_at: session.completed_at || null,
      total: nonNegativeInt(session.total),
      answered: nonNegativeInt(session.answered),
      correct: nonNegativeInt(session.correct),
      incorrect: nonNegativeInt(session.incorrect),
      score_percent: Number.isFinite(session.score_percent)
        ? clamp01(Number(session.score_percent) / 100) * 100
        : 0,
      source_type: safeText(session.source_type),
      status: safeText(session.status) || (session.completed_at ? "COMPLETED" : "UNKNOWN"),
      section: safeText(session.section),
      metadata: session.metadata && typeof session.metadata === "object"
        ? clone(session.metadata)
        : {}
    };
  }

  function makeId(prefix = "evt") {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }


  function migrateLegacyProgress(storage) {
    const migrated = createEmptyState();
    const now = nowIso();
    let changed = false;
    try {
      const legacyRaw = storage.getItem("ssw-gh-progress");
      if (legacyRaw) {
        const legacy = JSON.parse(legacyRaw);
        const seen = Array.isArray(legacy.seen) ? legacy.seen : [];
        seen.forEach(factId => migrated.events.push(normalizeEvent({
          event_id: makeId("migrate"), type: EVENT_TYPES.STUDY_OPEN, occurred_at: now,
          source: "LEGACY_MIGRATION", track: "GROUND_HANDLING", fact_id: factId, study_id: factId,
          metadata: { migrated_from: "ssw-gh-progress" }
        })));
        const history = Array.isArray(legacy.history) ? legacy.history : [];
        history.forEach(h => migrated.events.push(normalizeEvent({
          event_id: makeId("migrate"), type: EVENT_TYPES.MCQ_ANSWER,
          occurred_at: h.at ? new Date(h.at).toISOString() : now, source: "LEGACY_MIGRATION",
          track: "GROUND_HANDLING", question_id: h.question_id, correct: h.correct,
          metadata: { migrated_from: "ssw-gh-progress" }
        })));
        changed = seen.length > 0 || history.length > 0;
      }
      const studyRaw = storage.getItem("ssw-aviation-study-progress-v1");
      if (studyRaw) {
        const legacyStudy = JSON.parse(studyRaw);
        Object.keys(legacyStudy?.opened || {}).forEach(studyId => migrated.events.push(normalizeEvent({
          event_id: makeId("migrate"), type: EVENT_TYPES.STUDY_OPEN, occurred_at: new Date(legacyStudy.opened[studyId]).toISOString(),
          source: "LEGACY_MIGRATION", track: "GROUND_HANDLING", fact_id: studyId, study_id: studyId,
          metadata: { migrated_from: "ssw-aviation-study-progress-v1" }
        })));
        Object.keys(legacyStudy?.completed || {}).forEach(studyId => migrated.events.push(normalizeEvent({
          event_id: makeId("migrate"), type: EVENT_TYPES.STUDY_COMPLETE, occurred_at: legacyStudy.completed[studyId]?.completed_at || now,
          source: "LEGACY_MIGRATION", track: "GROUND_HANDLING", fact_id: studyId, study_id: studyId,
          metadata: { migrated_from: "ssw-aviation-study-progress-v1" }
        })));
        changed = true;
      }
    } catch (_) {}
    migrated.events.sort((a,b)=>a.occurred_at.localeCompare(b.occurred_at));
    if (changed) {
      try { storage.setItem(STORAGE_KEY, JSON.stringify(migrated)); } catch (_) {}
    }
    return migrated;
  }

  class ProgressStore {
    constructor(options = {}) {
      this.storageKey = options.storageKey || STORAGE_KEY;
      this.maxEvents = Number.isInteger(options.maxEvents)
        ? options.maxEvents
        : MAX_EVENT_HISTORY;
      this.storage = options.storage || null;
      this.state = normalizeState(options.state || this.load());
      this.listeners = new Set();
    }

    getStorage() {
      if (this.storage) return this.storage;
      if (typeof window !== "undefined" && window.localStorage) {
        return window.localStorage;
      }
      return null;
    }

    load() {
      const storage = this.getStorage();
      if (!storage) return createEmptyState();
      try {
        const raw = storage.getItem(this.storageKey);
        if (raw) return JSON.parse(raw);
        return migrateLegacyProgress(storage);
      } catch (_) {
        return createEmptyState();
      }
    }

    save() {
      this.state.updated_at = nowIso();
      const storage = this.getStorage();
      if (storage) {
        try {
          storage.setItem(this.storageKey, JSON.stringify(this.state));
        } catch (_) {
          // Storage quota/private mode must not break study use.
        }
      }
      this.emit();
      return this.snapshot();
    }

    snapshot() {
      return clone(this.state);
    }

    onChange(callback) {
      this.listeners.add(callback);
      return () => this.listeners.delete(callback);
    }

    emit() {
      const snapshot = this.snapshot();
      for (const callback of this.listeners) {
        try { callback(snapshot); } catch (_) {}
      }
    }

    record(type, payload = {}) {
      if (!Object.values(EVENT_TYPES).includes(type)) {
        throw new Error(`Unknown progress event type: ${type}`);
      }

      const event = normalizeEvent({
        ...payload,
        event_id: payload.event_id || makeId("evt"),
        type,
        occurred_at: payload.occurred_at || nowIso()
      });

      this.state.events.push(event);
      if (this.state.events.length > this.maxEvents) {
        this.state.events.splice(0, this.state.events.length - this.maxEvents);
      }
      this.save();
      return event;
    }

    recordStudyOpen(payload) { return this.record(EVENT_TYPES.STUDY_OPEN, payload); }
    recordStudyComplete(payload) { return this.record(EVENT_TYPES.STUDY_COMPLETE, payload); }
    recordMcqAnswer(payload) { return this.record(EVENT_TYPES.MCQ_ANSWER, payload); }
    recordExamComplete(payload) { return this.record(EVENT_TYPES.EXAM_COMPLETE, payload); }
    recordVisualView(payload) { return this.record(EVENT_TYPES.VISUAL_VIEW, payload); }
    recordGlossaryView(payload) { return this.record(EVENT_TYPES.GLOSSARY_VIEW, payload); }
    recordAudioPlay(payload) { return this.record(EVENT_TYPES.AUDIO_PLAY, payload); }
    recordExamStart(payload) { return this.record(EVENT_TYPES.EXAM_START, payload); }
    recordExamAnswer(payload) { return this.record(EVENT_TYPES.EXAM_ANSWER, payload); }
    recordExamAbandon(payload) { return this.record(EVENT_TYPES.EXAM_ABANDON, payload); }

    addSession(session) {
      const normalized = normalizeSession({
        ...session,
        session_id: session.session_id || makeId("session")
      });
      this.state.sessions.push(normalized);
      if (this.state.sessions.length > 1000) this.state.sessions.shift();
      this.save();
      return normalized;
    }

    reset() {
      this.state = createEmptyState();
      this.save();
      return this.snapshot();
    }

    events(options = {}) {
      let records = [...this.state.events];
      if (options.type) records = records.filter(e => e.type === options.type);
      if (options.topic_id) records = records.filter(e => e.topic_id === options.topic_id);
      if (options.chapter_id) records = records.filter(e => e.chapter_id === options.chapter_id);
      if (options.question_id) records = records.filter(e => e.question_id === options.question_id);
      if (options.from) records = records.filter(e => e.occurred_at >= options.from);
      if (options.to) records = records.filter(e => e.occurred_at <= options.to);
      return records;
    }

    sessions(options = {}) {
      let records = [...this.state.sessions];
      if (options.session_type) records = records.filter(s => s.session_type === options.session_type);
      if (options.from) records = records.filter(s => safeText(s.started_at) >= options.from);
      if (options.to) records = records.filter(s => safeText(s.started_at) <= options.to);
      return records;
    }
  }

  function summarizeAccuracy(events) {
    const answers = events.filter(e => e.type === EVENT_TYPES.MCQ_ANSWER && typeof e.correct === "boolean");
    const correct = answers.filter(e => e.correct).length;
    const incorrect = answers.length - correct;
    return {
      answered: answers.length,
      correct,
      incorrect,
      accuracy_percent: answers.length ? Number(((correct / answers.length) * 100).toFixed(2)) : 0
    };
  }

  function groupAccuracy(events, key) {
    const groups = new Map();
    for (const event of events) {
      if (event.type !== EVENT_TYPES.MCQ_ANSWER || typeof event.correct !== "boolean") continue;
      const value = safeText(event[key]) || "UNASSIGNED";
      if (!groups.has(value)) groups.set(value, { key: value, answered: 0, correct: 0, incorrect: 0 });
      const item = groups.get(value);
      item.answered += 1;
      if (event.correct) item.correct += 1;
      else item.incorrect += 1;
    }
    return [...groups.values()].map(item => ({
      ...item,
      accuracy_percent: item.answered
        ? Number(((item.correct / item.answered) * 100).toFixed(2))
        : 0
    }));
  }

  function dailyActivity(events, days = 14, referenceDate = new Date()) {
    const result = [];
    const ref = new Date(referenceDate);
    ref.setUTCHours(0, 0, 0, 0);
    for (let i = days - 1; i >= 0; i -= 1) {
      const d = new Date(ref);
      d.setUTCDate(ref.getUTCDate() - i);
      const key = dateKey(d);
      const dayEvents = events.filter(e => dateKey(e.occurred_at) === key);
      const studySeconds = dayEvents.reduce((sum, e) => sum + (e.type === EVENT_TYPES.STUDY_COMPLETE ? e.duration_seconds : 0), 0);
      const questions = dayEvents.filter(e => e.type === EVENT_TYPES.MCQ_ANSWER).length;
      const correct = dayEvents.filter(e => e.type === EVENT_TYPES.MCQ_ANSWER && e.correct === true).length;
      result.push({
        date: key,
        events: dayEvents.length,
        questions,
        correct,
        study_minutes: Number((studySeconds / 60).toFixed(1)),
        accuracy_percent: questions ? Number(((correct / questions) * 100).toFixed(2)) : 0
      });
    }
    return result;
  }

  function calculateStreak(events, referenceDate = new Date()) {
    const activeDays = new Set(events.map(e => dateKey(e.occurred_at)).filter(Boolean));
    let cursor = new Date(referenceDate);
    cursor.setUTCHours(0, 0, 0, 0);
    let streak = 0;

    while (activeDays.has(dateKey(cursor))) {
      streak += 1;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }

    return streak;
  }

  function calculateWeekly(events, weeks = 8) {
    const current = new Date();
    const currentWeek = weekKey(current);
    const result = [];
    const seen = new Map();

    for (const event of events) {
      const key = weekKey(event.occurred_at);
      if (!key) continue;
      if (!seen.has(key)) seen.set(key, { week: key, events: 0, questions: 0, correct: 0, study_minutes: 0 });
      const item = seen.get(key);
      item.events += 1;
      if (event.type === EVENT_TYPES.MCQ_ANSWER) {
        item.questions += 1;
        if (event.correct === true) item.correct += 1;
      }
      if (event.type === EVENT_TYPES.STUDY_COMPLETE) item.study_minutes += event.duration_seconds / 60;
    }

    // Keep chronological historical buckets that actually exist; add current week if empty.
    const keys = [...seen.keys()].sort().slice(-Math.max(weeks - 1, 0));
    if (!seen.has(currentWeek)) keys.push(currentWeek);
    else if (!keys.includes(currentWeek)) keys.push(currentWeek);

    for (const key of keys.slice(-weeks)) {
      const item = seen.get(key) || { week: key, events: 0, questions: 0, correct: 0, study_minutes: 0 };
      result.push({
        ...item,
        study_minutes: Number(item.study_minutes.toFixed(1)),
        accuracy_percent: item.questions ? Number(((item.correct / item.questions) * 100).toFixed(2)) : 0
      });
    }
    return result;
  }

  function buildAnalytics(store, options = {}) {
    const events = store.events();
    const mcq = summarizeAccuracy(events);
    const studyCompleted = events.filter(e => e.type === EVENT_TYPES.STUDY_COMPLETE);
    const studySeconds = studyCompleted.reduce((sum, e) => sum + e.duration_seconds, 0);
    const topicAccuracy = groupAccuracy(events, "topic_id");
    const chapterAccuracy = groupAccuracy(events, "chapter_id");

    const weakAreas = topicAccuracy
      .filter(item => item.answered >= (options.minimumAnswers || 3))
      .sort((a, b) => a.accuracy_percent - b.accuracy_percent)
      .slice(0, options.weakAreaLimit || 10);

    return {
      generated_at: nowIso(),
      totals: {
        event_count: events.length,
        study_completed: studyCompleted.length,
        study_opened: events.filter(e => e.type === EVENT_TYPES.STUDY_OPEN).length,
        study_minutes: Number((studySeconds / 60).toFixed(1)),
        mcq_answered: mcq.answered,
        mcq_correct: mcq.correct,
        mcq_incorrect: mcq.incorrect,
        mcq_accuracy_percent: mcq.accuracy_percent,
        sessions_completed: store.sessions().filter(s => s.completed_at).length,
        visual_views: events.filter(e => e.type === EVENT_TYPES.VISUAL_VIEW).length,
        glossary_views: events.filter(e => e.type === EVENT_TYPES.GLOSSARY_VIEW).length,
        audio_plays: events.filter(e => e.type === EVENT_TYPES.AUDIO_PLAY).length,
        exam_starts: events.filter(e => e.type === EVENT_TYPES.EXAM_START).length,
        exam_answers: events.filter(e => e.type === EVENT_TYPES.EXAM_ANSWER).length,
        exam_abandons: events.filter(e => e.type === EVENT_TYPES.EXAM_ABANDON).length,
        exam_sessions: store.sessions().filter(s => String(s.session_type).startsWith("REAL_EXAM_")).length,
        exam_completed: store.sessions().filter(s => String(s.session_type).startsWith("REAL_EXAM_") && s.status === "COMPLETED").length,
        exam_passed: store.sessions().filter(s => String(s.session_type).startsWith("REAL_EXAM_") && s.status === "COMPLETED" && s.metadata?.passed === true).length
      },
      streak: {
        current_days: calculateStreak(events),
        active_days_total: new Set(events.map(e => dateKey(e.occurred_at)).filter(Boolean)).size
      },
      daily: dailyActivity(events, options.days || 14),
      weekly: calculateWeekly(events, options.weeks || 8),
      topic_accuracy: topicAccuracy.sort((a, b) => b.answered - a.answered),
      chapter_accuracy: chapterAccuracy.sort((a, b) => b.answered - a.answered),
      exam_sessions: store.sessions().filter(s => String(s.session_type).startsWith("REAL_EXAM_")).sort((a,b) => String(b.started_at || "").localeCompare(String(a.started_at || ""))),
      recent_exam_sessions: store.sessions().filter(s => String(s.session_type).startsWith("REAL_EXAM_")).sort((a,b) => String(b.started_at || "").localeCompare(String(a.started_at || ""))).slice(0, 10),
      weak_areas: weakAreas,
      source_breakdown: summarizeSourceTypes(store),
      last_activity_at: events.length ? events[events.length - 1].occurred_at : null
    };
  }

  function summarizeSourceTypes(store) {
    const map = new Map();
    for (const event of store.events()) {
      const source = event.source || "UNKNOWN";
      map.set(source, (map.get(source) || 0) + 1);
    }
    return [...map.entries()].map(([source, count]) => ({ source, count }));
  }

  function createProgressModel(analytics) {
    const a = analytics || buildAnalytics(new ProgressStore({ state: createEmptyState() }));
    return {
      headline: `${a.totals.mcq_accuracy_percent}% MCQ accuracy`,
      streak_text: `${a.streak.current_days}-day active streak`,
      study_text: `${a.totals.study_minutes} minutes studied`,
      question_text: `${a.totals.mcq_answered} questions answered`,
      weak_areas: a.weak_areas,
      daily: a.daily,
      weekly: a.weekly,
      topic_accuracy: a.topic_accuracy,
      chapter_accuracy: a.chapter_accuracy
    };
  }

  const API = {
    SCHEMA_VERSION,
    STORAGE_KEY,
    EVENT_TYPES,
    createEmptyState,
    migrateLegacyProgress,
    normalizeState,
    normalizeEvent,
    normalizeSession,
    ProgressStore,
    summarizeAccuracy,
    groupAccuracy,
    dailyActivity,
    calculateStreak,
    calculateWeekly,
    buildAnalytics,
    createProgressModel
  };

  if (typeof module !== "undefined" && module.exports) module.exports = API;
  if (typeof window !== "undefined") window.SSWGHProgress = API;
})();
