/* BUILD-04 — Study Engine
 *
 * Source-derived study content only.
 * This engine renders verified study blocks; it does not create facts.
 */
(function () {
  "use strict";

  const DEFAULT_SECTION_ORDER = Object.freeze([
    "core_knowledge",
    "definition",
    "procedure",
    "safety",
    "equipment",
    "warning",
    "distinction",
    "example",
    "exam_point"
  ]);

  const STATUS = Object.freeze({
    VERIFIED: "VERIFIED",
    DRAFT: "DRAFT",
    TRANSLATION_REVIEW: "TRANSLATION_REVIEW",
    TERM_REVIEW: "TERM_REVIEW",
    SOURCE_REVIEW: "SOURCE_REVIEW",
    PENDING: "PENDING",
    BLOCKED: "BLOCKED"
  });

  function text(value) {
    return value == null ? "" : String(value);
  }

  function nonEmpty(value) {
    return text(value).trim().length > 0;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeStudyBlock(record) {
    if (!record || typeof record !== "object") return null;

    return {
      study_id: record.study_id || null,
      fact_id: record.fact_id || null,
      track: record.track || null,
      source_id: record.source_id || null,
      physical_page: Number.isInteger(record.physical_page)
        ? record.physical_page
        : null,
      printed_page: Number.isInteger(record.printed_page)
        ? record.printed_page
        : null,
      chapter_id: record.chapter_id || null,
      topic_id: record.topic_id || null,
      subtopic_id: record.subtopic_id || null,

      original: {
        title: text(record.original?.title),
        content: text(record.original?.content)
      },

      content: {
        core_knowledge: text(record.content?.core_knowledge),
        definition: text(record.content?.definition),
        procedure: Array.isArray(record.content?.procedure)
          ? record.content.procedure.map((step, index) => ({
              step: Number.isInteger(step?.step) ? step.step : index + 1,
              text: text(step?.text)
            }))
          : [],
        safety: text(record.content?.safety),
        equipment: Array.isArray(record.content?.equipment)
          ? record.content.equipment.map(text)
          : [],
        warning: text(record.content?.warning),
        distinction: text(record.content?.distinction),
        example: text(record.content?.example),
        exam_point: text(record.content?.exam_point)
      },

      terminology: Array.isArray(record.terminology)
        ? record.terminology.map(term => ({
            term_id: term?.term_id || null,
            japanese: text(term?.japanese),
            furigana: text(term?.furigana),
            english: text(term?.english),
            sinhala: text(term?.sinhala),
            status: term?.status || "PENDING"
          }))
        : [],

      illustration_ids: Array.isArray(record.illustration_ids)
        ? [...record.illustration_ids]
        : [],

      audio_block_ids: Array.isArray(record.audio_block_ids)
        ? [...record.audio_block_ids]
        : [],

      question_ids: Array.isArray(record.question_ids)
        ? [...record.question_ids]
        : [],

      status: record.status || STATUS.PENDING,
      verification_status: record.verification_status || record.status || STATUS.PENDING
    };
  }

  function validateStudyBlock(record, provenanceEngine) {
    const errors = [];
    const warnings = [];

    if (!record) {
      return { valid: false, errors: ["STUDY-001: missing study record"], warnings };
    }

    if (!record.study_id) errors.push("STUDY-002: missing study_id");
    if (!record.fact_id) errors.push("STUDY-003: missing fact_id");
    if (!record.track) errors.push("STUDY-004: missing track");
    if (!record.topic_id) errors.push("STUDY-005: missing topic_id");

    if (record.status === STATUS.VERIFIED) {
      if (!nonEmpty(record.original?.content) &&
          !Object.values(record.content || {}).some(v =>
            typeof v === "string" ? nonEmpty(v) : Array.isArray(v) && v.length
          )) {
        errors.push("STUDY-006: VERIFIED study block has no substantive content");
      }

      if (!record.content?.sinhala && !record.sinhala) {
        errors.push("TRI-001: VERIFIED substantive study block requires Sinhala explanation");
      }

      if (!provenanceEngine) {
        errors.push("STUDY-007: provenance engine required for VERIFIED study content");
      } else {
        const result = provenanceEngine.validate(record);
        if (!result.valid) {
          errors.push(...result.errors);
        }
      }
    }

    if (record.status === STATUS.PENDING) {
      warnings.push("STUDY-W001: pending study content is not eligible for verified presentation.");
    }

    for (const term of record.terminology || []) {
      if (term.status === "VERIFIED" && !nonEmpty(term.japanese)) {
        errors.push("TRI-002: VERIFIED Japanese terminology is missing Japanese source term");
      }
    }

    for (const step of record.content?.procedure || []) {
      if (!Number.isInteger(step.step) || !nonEmpty(step.text)) {
        errors.push("STUDY-008: procedure step must contain ordered step number and text");
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  class StudyStore {
    constructor(studyData, topicData, chapterData, sourceData, provenanceEngine) {
      this.studyData = studyData || {};
      this.topicData = topicData || {};
      this.chapterData = chapterData || {};
      this.sourceData = sourceData || {};
      this.provenanceEngine = provenanceEngine || null;

      this.blocks = Array.isArray(this.studyData.study_blocks)
        ? this.studyData.study_blocks
            .map(normalizeStudyBlock)
            .filter(Boolean)
        : [];

      this.topics = new Map(
        (this.topicData.topics || []).map(topic => [topic.topic_id, topic])
      );

      this.chapters = new Map(
        (this.chapterData.chapters || []).map(chapter => [chapter.chapter_id, chapter])
      );

      this.sources = new Map(
        (this.sourceData.sources || []).map(source => [source.source_id, source])
      );
    }

    all(options = {}) {
      let records = [...this.blocks];

      if (options.track) {
        records = records.filter(r => r.track === options.track);
      }

      if (options.topic_id) {
        records = records.filter(r => r.topic_id === options.topic_id);
      }

      if (options.status) {
        records = records.filter(r => r.status === options.status);
      }

      return records;
    }

    verified(options = {}) {
      return this.all({ ...options, status: STATUS.VERIFIED });
    }

    get(studyId) {
      return this.blocks.find(record => record.study_id === studyId) || null;
    }

    topic(topicId) {
      return this.topics.get(topicId) || null;
    }

    chapter(chapterId) {
      return this.chapters.get(chapterId) || null;
    }

    source(sourceId) {
      return this.sources.get(sourceId) || null;
    }

    getTopicStudy(topicId, options = {}) {
      return this.all({ ...options, topic_id: topicId });
    }

    search(query, options = {}) {
      const q = text(query).trim().toLowerCase();
      if (!q) return this.all(options);

      return this.all(options).filter(record => {
        const topic = this.topic(record.topic_id);
        const haystack = [
          record.original.title,
          record.original.content,
          ...Object.values(record.content).flatMap(value =>
            Array.isArray(value) ? value.map(x => x?.text || x) : [value]
          ),
          ...(record.terminology || []).flatMap(term => [
            term.japanese, term.furigana, term.english, term.sinhala
          ]),
          topic?.title
        ].join(" ").toLowerCase();

        return haystack.includes(q);
      });
    }

    validateAll() {
      return this.blocks.map(record => ({
        study_id: record.study_id,
        ...validateStudyBlock(record, this.provenanceEngine)
      }));
    }
  }

  class StudyProgress {
    constructor() {
      if (window.SSWGHProgress) this.store = new window.SSWGHProgress.ProgressStore({});
      else this.store = null;
    }

    open(studyId, metadata = {}) {
      if (!studyId || !this.store) return;
      this.store.recordStudyOpen({
        track: metadata.track || "GROUND_HANDLING",
        fact_id: metadata.fact_id || studyId,
        study_id: studyId,
        source_id: metadata.source_id || "",
        topic_id: metadata.topic_id || "",
        chapter_id: metadata.chapter_id || "",
        source: metadata.source || "STUDY_ENGINE"
      });
    }

    complete(studyId, metadata = {}) {
      if (!studyId || !this.store) return;
      this.store.recordStudyComplete({
        track: metadata.track || "GROUND_HANDLING",
        fact_id: metadata.fact_id || studyId,
        study_id: studyId,
        source_id: metadata.source_id || "",
        topic_id: metadata.topic_id || "",
        chapter_id: metadata.chapter_id || "",
        duration_seconds: Number(metadata.duration_seconds) || 0,
        source: metadata.source || "STUDY_ENGINE"
      });
    }

    reset() {
      if (!this.store) return;
      const events = this.store.events({ type: "STUDY_COMPLETE" });
      for (const event of events) {
        // Historical events remain immutable; reset is intentionally handled at the
        // unified store level rather than deleting individual source records.
      }
    }

    isCompleted(studyId) {
      if (!this.store) return false;
      return this.store.events({ type: "STUDY_COMPLETE", study_id: studyId }).length > 0;
    }

    summary(studyRecords) {
      const total = studyRecords.length;
      const completed = studyRecords.filter(r => this.isCompleted(r.study_id)).length;
      return { total, completed, remaining: Math.max(total - completed, 0), percent: total ? Math.round((completed / total) * 100) : 0 };
    }
  }

  function buildPresentationModel(record, store) {
    if (!record) return null;

    const topic = store.topic(record.topic_id);
    const chapter = topic ? store.chapter(topic.chapter_id) : null;
    const source = store.source(record.source_id);

    const sections = [];

    for (const key of DEFAULT_SECTION_ORDER) {
      const value = record.content[key];

      if (key === "procedure" && Array.isArray(value) && value.length) {
        sections.push({
          type: "procedure",
          key,
          items: value.map(step => ({
            step: step.step,
            text: step.text
          }))
        });
        continue;
      }

      if (Array.isArray(value) && value.length) {
        sections.push({ type: key, key, items: value });
      } else if (nonEmpty(value)) {
        sections.push({ type: key, key, text: value });
      }
    }

    return {
      study_id: record.study_id,
      fact_id: record.fact_id,
      track: record.track,
      hierarchy: {
        chapter_id: chapter?.chapter_id || null,
        chapter_title: chapter?.title || null,
        topic_id: topic?.topic_id || record.topic_id,
        topic_title: topic?.title || null
      },
      source: {
        source_id: source?.source_id || record.source_id,
        title: source?.title || null,
        physical_page: record.physical_page,
        printed_page: record.printed_page,
        reference: record.source_reference || null
      },
      original: record.original,
      sections,
      terminology: record.terminology,
      illustration_ids: record.illustration_ids,
      audio_block_ids: record.audio_block_ids,
      question_ids: record.question_ids,
      status: record.status
    };
  }

  window.SSWStudy = {
    STATUS,
    DEFAULT_SECTION_ORDER,
    normalizeStudyBlock,
    validateStudyBlock,
    StudyStore,
    StudyProgress,
    buildPresentationModel
  };
})();
