/* BUILD-11 — Study Mode
 *
 * Learner presentation layer for verified study blocks.
 * Source content remains immutable and is never invented here.
 */
(function () {
  "use strict";

  const STUDY_SECTIONS = Object.freeze([
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

  const STUDY_STATUS = Object.freeze([
    "DRAFT",
    "TRANSLATION_REVIEW",
    "TERM_REVIEW",
    "SOURCE_REVIEW",
    "PENDING",
    "VERIFIED"
  ]);

  function normalizeStudyBlock(record) {
    if (!record || typeof record !== "object") return null;

    const content = record.content || {};

    const normalizedContent = {};
    for (const section of STUDY_SECTIONS) {
      const value = content[section];
      normalizedContent[section] = value || {
        ja: "",
        en: "",
        si: ""
      };
    }

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

      original_title: record.original_title || "",
      original_content: record.original_content || "",

      content: normalizedContent,

      terminology: Array.isArray(record.terminology)
        ? record.terminology.map(term => ({
            term_id: term.term_id || null,
            japanese: term.japanese || "",
            furigana: term.furigana || "",
            english: term.english || "",
            sinhala: term.sinhala || "",
            status: term.status || "PENDING"
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

      status: record.status || "DRAFT",
      verification_status: record.verification_status || "PENDING"
    };
  }

  function validateStudyBlock(block, context = {}) {
    const errors = [];
    const warnings = [];

    if (!block.study_id) errors.push("STUDY-001: missing study_id");
    if (!block.fact_id) errors.push("STUDY-002: missing fact_id");
    if (!block.track) errors.push("STUDY-003: missing track");
    if (!block.source_id) errors.push("STUDY-004: missing source_id");

    if (!Number.isInteger(block.physical_page) || block.physical_page < 1) {
      errors.push("STUDY-005: physical_page must be positive");
    }

    if (!context.sources?.has(block.source_id)) {
      errors.push("STUDY-006: source_id is not registered");
    }

    const source = context.sources?.get(block.source_id);
    if (source && source.track !== block.track) {
      errors.push("STUDY-007: track/source mismatch");
    }

    if (!STUDY_STATUS.includes(block.status)) {
      errors.push("STUDY-008: unsupported study status");
    }

    if (block.verification_status === "VERIFIED") {
      if (!block.original_content) {
        warnings.push(
          "STUDY-W001: VERIFIED block has no original_content field."
        );
      }

      const substantiveSections = STUDY_SECTIONS.filter(section => {
        const item = block.content[section];
        return item && (item.en || item.ja || item.si);
      });

      for (const section of substantiveSections) {
        const item = block.content[section];

        if (!item.si) {
          errors.push(
            `TRI-001: verified section ${section} is missing Sinhala explanation`
          );
        }
      }

      for (const term of block.terminology) {
        if (term.status === "VERIFIED" && !term.japanese) {
          errors.push(
            `TERM-001: verified terminology ${term.term_id || "unknown"} lacks Japanese term`
          );
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  class StudyModeStore {
    constructor(studyData, sourceData, dependencies = {}) {
      this.blocks = (studyData?.study_blocks || [])
        .map(normalizeStudyBlock)
        .filter(Boolean);

      this.sources = new Map(
        (sourceData?.sources || []).map(source => [
          source.source_id,
          source
        ])
      );

      this.visualStore = dependencies.visualStore || null;
      this.glossaryStore = dependencies.glossaryStore || null;
      this.audioStore = dependencies.audioStore || null;
      this.questionStore = dependencies.questionStore || null;

      this.index = new Map(
        this.blocks.map(block => [block.study_id, block])
      );
    }

    get(studyId) {
      return this.index.get(studyId) || null;
    }

    all(options = {}) {
      let blocks = [...this.blocks];

      if (options.track) {
        blocks = blocks.filter(block => block.track === options.track);
      }

      if (options.chapter_id) {
        blocks = blocks.filter(
          block => block.chapter_id === options.chapter_id
        );
      }

      if (options.topic_id) {
        blocks = blocks.filter(
          block => block.topic_id === options.topic_id
        );
      }

      if (options.status) {
        blocks = blocks.filter(block => block.status === options.status);
      }

      if (options.verification_status) {
        blocks = blocks.filter(
          block => block.verification_status === options.verification_status
        );
      }

      return blocks;
    }

    verified(options = {}) {
      return this.all({
        ...options,
        status: "VERIFIED",
        verification_status: "VERIFIED"
      });
    }

    search(query, options = {}) {
      const q = String(query || "").trim().toLowerCase();
      if (!q) return this.all(options);

      return this.all(options).filter(block => {
        const sections = STUDY_SECTIONS.flatMap(section => {
          const item = block.content[section] || {};
          return [item.ja, item.en, item.si];
        });

        const terms = block.terminology.flatMap(term => [
          term.japanese,
          term.furigana,
          term.english,
          term.sinhala
        ]);

        const haystack = [
          block.original_title,
          block.original_content,
          block.fact_id,
          block.study_id,
          ...sections,
          ...terms
        ].join(" ").toLowerCase();

        return haystack.includes(q);
      });
    }

    presentationModel(studyId, options = {}) {
      const block = this.get(studyId);
      if (!block) return null;

      const model = {
        study_id: block.study_id,
        fact_id: block.fact_id,
        title: block.original_title,
        source: {
          source_id: block.source_id,
          physical_page: block.physical_page,
          printed_page: block.printed_page
        },
        track: block.track,
        chapter_id: block.chapter_id,
        topic_id: block.topic_id,
        sections: [],
        terminology: [],
        illustrations: [],
        audio: [],
        questions: [],
        verification_status: block.verification_status
      };

      for (const section of STUDY_SECTIONS) {
        const content = block.content[section];

        if (!content || (!content.ja && !content.en && !content.si)) {
          continue;
        }

        model.sections.push({
          key: section,
          content: {
            japanese: content.ja || "",
            english: content.en || "",
            sinhala: content.si || ""
          }
        });
      }

      model.terminology = block.terminology.filter(term =>
        options.includePendingTerms === true
          ? true
          : term.status === "VERIFIED"
      );

      if (this.visualStore) {
        model.illustrations = block.illustration_ids
          .map(id => this.visualStore.get(id))
          .filter(Boolean)
          .filter(visual =>
            options.includePendingVisuals === true
              ? true
              : visual.visual_status === "VERIFIED" &&
                visual.relationship_status === "VERIFIED"
          );
      }

      if (this.audioStore) {
        model.audio = block.audio_block_ids
          .map(id => this.audioStore.get(id))
          .filter(Boolean);
      }

      if (this.questionStore) {
        model.questions = block.question_ids
          .map(id => this.questionStore.get(id))
          .filter(Boolean);
      }

      return model;
    }
  }

  class StudySession {
    constructor(store, progressStore = null) {
      this.store = store;
      this.progressStore = progressStore;
      this.currentStudyId = null;
      this.startedAt = null;
    }

    open(studyId) {
      const block = this.store.get(studyId);
      if (!block) return null;

      this.currentStudyId = studyId;
      this.startedAt = new Date().toISOString();

      if (this.progressStore?.open) {
        this.progressStore.open(studyId);
      }

      return this.store.presentationModel(studyId);
    }

    current() {
      return this.currentStudyId
        ? this.store.presentationModel(this.currentStudyId)
        : null;
    }

    complete() {
      if (!this.currentStudyId) return false;

      if (this.progressStore?.complete) {
        this.progressStore.complete(this.currentStudyId);
      }

      return true;
    }

    reset() {
      this.currentStudyId = null;
      this.startedAt = null;
    }
  }

  window.SSWStudyMode = {
    STUDY_SECTIONS,
    STUDY_STATUS,
    normalizeStudyBlock,
    validateStudyBlock,
    StudyModeStore,
    StudySession
  };
})();
