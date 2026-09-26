/* BUILD-07 — Question Engine
 *
 * Strict source-gated question architecture.
 * It does not invent facts, choices, answers, or exam claims.
 */
(function () {
  "use strict";

  const SOURCE_TYPES = Object.freeze({
    OFFICIAL_SAMPLE: "OFFICIAL_SAMPLE",
    SOURCE_BASED_PRACTICE: "SOURCE_BASED_PRACTICE",
    PREDICTED_PRACTICE: "PREDICTED_PRACTICE"
  });

  const QUESTION_TYPES = Object.freeze([
    "DIRECT",
    "NUMERICAL",
    "TRUE_FALSE",
    "SCENARIO",
    "PROCEDURE",
    "VISUAL",
    "TERMINOLOGY",
    "DISTINCTION",
    "EXCEPTION",
    "MATCHING"
  ]);

  const STATUS = Object.freeze({
    DRAFT: "DRAFT",
    REVIEW_REQUIRED: "REVIEW_REQUIRED",
    PENDING_SOURCE_VERIFICATION: "PENDING_SOURCE_VERIFICATION",
    BLOCKED: "BLOCKED",
    VERIFIED: "VERIFIED"
  });

  const PREDICTED_LABEL =
    "PREDICTED PRACTICE — NOT AN OFFICIAL EXAM QUESTION";

  const SOURCE_BASED_LABEL = "SOURCE-BASED PRACTICE";

  function normalizeChoice(choice) {
    return {
      choice_id: choice?.choice_id || null,
      text: choice?.text || "",
      english: choice?.english || choice?.text || "",
      sinhala: choice?.sinhala || "",
      japanese: choice?.japanese || ""
    };
  }

  function normalizeQuestion(record) {
    if (!record || typeof record !== "object") return null;

    return {
      question_id: record.question_id || null,
      track: record.track || null,
      source_type: record.source_type || null,
      question_type: record.question_type || null,
      category: record.category || null,
      fact_id: record.fact_id || null,

      source: {
        source_id: record.source?.source_id || record.source_id || null,
        source_pdf: record.source?.source_pdf || null,
        physical_page: Number.isInteger(record.source?.physical_page)
          ? record.source.physical_page
          : Number.isInteger(record.physical_page)
            ? record.physical_page
            : null,
        printed_page: Number.isInteger(record.source?.printed_page)
          ? record.source.printed_page
          : Number.isInteger(record.printed_page)
            ? record.printed_page
            : null,
        source_reference: record.source?.source_reference || null
      },

      question: {
        english: record.question?.english || record.question_english || "",
        sinhala: record.question?.sinhala || record.question_sinhala || "",
        japanese: record.question?.japanese || ""
      },

      choices: Array.isArray(record.choices)
        ? record.choices.map(normalizeChoice)
        : [],

      correct_choice_id: record.correct_choice_id || null,

      explanation: {
        english: record.explanation?.english || "",
        sinhala: record.explanation?.sinhala || "",
        japanese: record.explanation?.japanese || ""
      },

      japanese_terms: Array.isArray(record.japanese_terms)
        ? [...record.japanese_terms]
        : [],

      visual_id: record.visual_id || null,
      exam_distinction: record.exam_distinction || null,
      audio_block_ids: Array.isArray(record.audio_block_ids)
        ? [...record.audio_block_ids]
        : [],

      official: record.official === true,
      immutable: record.immutable === true,
      label: record.label || null,
      status: record.status || STATUS.DRAFT
    };
  }

  function validateQuestion(record, context = {}) {
    const errors = [];
    const warnings = [];

    if (!record) {
      return { valid: false, errors: ["Q-001: missing question"], warnings };
    }

    if (!record.question_id) errors.push("Q-002: missing question_id");
    if (!record.track) errors.push("Q-003: missing track");
    if (!record.source_type) errors.push("Q-004: missing source_type");
    if (!QUESTION_TYPES.includes(record.question_type)) {
      errors.push("Q-005: unsupported question_type");
    }
    if (!record.category) errors.push("Q-006: missing category");
    if (!record.fact_id) {
      errors.push("Q-007: missing fact_id");
    }

    const validSourceTypes = Object.values(SOURCE_TYPES);
    if (!validSourceTypes.includes(record.source_type)) {
      errors.push("Q-008: invalid source_type");
    }

    const source = context.sources?.get(record.source.source_id);

    if (!record.source.source_id) {
      errors.push("Q-009: missing source_id");
    }

    if (!Number.isInteger(record.source.physical_page) ||
        record.source.physical_page < 1) {
      errors.push("Q-010: physical_page must be a positive integer");
    }

    if (!source) {
      errors.push("Q-011: source_id is not registered");
    } else if (source.track !== record.track) {
      errors.push("Q-012: track/source mismatch");
    }

    if (record.choices.length !== 4) {
      errors.push("Q-013: exactly four choices are required");
    }

    const choiceIds = record.choices.map(choice => choice.choice_id);
    if (new Set(choiceIds).size !== choiceIds.length) {
      errors.push("Q-014: duplicate choice_id");
    }

    if (!record.correct_choice_id) {
      errors.push("Q-015: missing correct_choice_id");
    } else if (!choiceIds.includes(record.correct_choice_id)) {
      errors.push("Q-016: correct_choice_id does not exist in choices");
    }

    if (!record.question.english) {
      errors.push("Q-017: missing English question");
    }

    if (!record.question.sinhala) {
      errors.push("TRI-001: missing Sinhala question meaning");
    }

    if (!record.explanation.english) {
      errors.push("Q-018: missing English explanation");
    }

    if (!record.explanation.sinhala) {
      errors.push("TRI-002: missing Sinhala explanation");
    }

    for (const choice of record.choices) {
      if (!choice.choice_id || !choice.english) {
        errors.push("Q-019: every choice requires choice_id and English text");
      }
    }

    if (record.source_type === SOURCE_TYPES.OFFICIAL_SAMPLE) {
      if (!record.official) {
        errors.push("Q-020: official sample must have official=true");
      }
      if (!record.immutable) {
        errors.push("Q-021: official sample must be immutable=true");
      }
    }

    if (record.source_type === SOURCE_TYPES.SOURCE_BASED_PRACTICE) {
      if (record.official) {
        errors.push("Q-022: source-based practice cannot be official");
      }
      if (record.label !== SOURCE_BASED_LABEL) {
        errors.push("Q-023: source-based practice requires exact label");
      }
    }

    if (record.source_type === SOURCE_TYPES.PREDICTED_PRACTICE) {
      if (record.official) {
        errors.push("Q-024: predicted practice cannot be official");
      }
      if (record.label !== PREDICTED_LABEL) {
        errors.push("Q-025: predicted practice requires exact non-official label");
      }
    }

    if (record.question_type === "VISUAL") {
      if (!record.visual_id) {
        errors.push("Q-026: visual question requires visual_id");
      }

      if (context.visualStore && record.visual_id) {
        if (!context.visualStore.canUseInVisualQuestion(record.visual_id)) {
          errors.push(
            "Q-027: visual question requires verified visual relationship and eligibility"
          );
        }
      }
    }

    if (record.status === STATUS.VERIFIED && errors.length) {
      errors.push("Q-028: invalid question cannot be VERIFIED");
    }

    if (record.status === STATUS.PENDING_SOURCE_VERIFICATION) {
      warnings.push(
        "Q-W001: question is pending and cannot enter verified exam content."
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  class QuestionStore {
    constructor(questionData, sourceData, visualStore = null) {
      this.questions = (questionData?.questions || [])
        .map(normalizeQuestion)
        .filter(Boolean);

      this.sources = new Map(
        (sourceData?.sources || []).map(source => [
          source.source_id,
          source
        ])
      );

      this.visualStore = visualStore;

      this.index = new Map(
        this.questions.map(question => [
          question.question_id,
          question
        ])
      );
    }

    get(questionId) {
      return this.index.get(questionId) || null;
    }

    all(options = {}) {
      let questions = [...this.questions];

      if (options.track) {
        questions = questions.filter(q => q.track === options.track);
      }

      if (options.source_type) {
        questions = questions.filter(q => q.source_type === options.source_type);
      }

      if (options.category) {
        questions = questions.filter(q => q.category === options.category);
      }

      if (options.question_type) {
        questions = questions.filter(q => q.question_type === options.question_type);
      }

      if (options.status) {
        questions = questions.filter(q => q.status === options.status);
      }

      return questions;
    }

    officialSamples(options = {}) {
      return this.all({
        ...options,
        source_type: SOURCE_TYPES.OFFICIAL_SAMPLE
      });
    }

    sourceBasedPractice(options = {}) {
      return this.all({
        ...options,
        source_type: SOURCE_TYPES.SOURCE_BASED_PRACTICE
      });
    }

    predictedPractice(options = {}) {
      return this.all({
        ...options,
        source_type: SOURCE_TYPES.PREDICTED_PRACTICE
      });
    }

    practice(options = {}) {
      return this.questions.filter(q =>
        q.source_type !== SOURCE_TYPES.OFFICIAL_SAMPLE &&
        (!options.track || q.track === options.track) &&
        (!options.category || q.category === options.category)
      );
    }

    search(query, options = {}) {
      const q = String(query || "").trim().toLowerCase();
      if (!q) return this.all(options);

      return this.all(options).filter(question => {
        const haystack = [
          question.question.english,
          question.question.sinhala,
          question.question.japanese,
          question.explanation.english,
          question.explanation.sinhala,
          question.category,
          question.fact_id,
          ...question.japanese_terms,
          ...question.choices.flatMap(choice => [
            choice.english,
            choice.sinhala,
            choice.japanese
          ])
        ].join(" ").toLowerCase();

        return haystack.includes(q);
      });
    }

    validate() {
      const errors = [];
      const warnings = [];
      const ids = new Set();

      for (const question of this.questions) {
        if (ids.has(question.question_id)) {
          errors.push(`Q-029: duplicate question_id ${question.question_id}`);
        }
        ids.add(question.question_id);

        const result = validateQuestion(question, {
          sources: this.sources,
          visualStore: this.visualStore
        });

        if (!result.valid) {
          errors.push({
            question_id: question.question_id,
            errors: result.errors
          });
        }

        warnings.push(
          ...result.warnings.map(warning => ({
            question_id: question.question_id,
            warning
          }))
        );
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        counts: {
          total: this.questions.length,
          official_samples: this.officialSamples().length,
          source_based: this.sourceBasedPractice().length,
          predicted: this.predictedPractice().length,
          verified: this.all({ status: STATUS.VERIFIED }).length
        }
      };
    }
  }

  class ExamSession {
    constructor(questionStore) {
      this.store = questionStore;
      this.questions = [];
      this.index = 0;
      this.answers = new Map();
      this.startedAt = null;
      this.finishedAt = null;
    }

    start(questionList) {
      this.questions = Array.isArray(questionList)
        ? [...questionList]
        : [];
      this.index = 0;
      this.answers.clear();
      this.startedAt = new Date().toISOString();
      this.finishedAt = null;
      return this.current();
    }

    current() {
      return this.questions[this.index] || null;
    }

    answer(choiceId) {
      const question = this.current();
      if (!question || !choiceId) return false;

      const exists = question.choices.some(
        choice => choice.choice_id === choiceId
      );

      if (!exists) return false;

      this.answers.set(question.question_id, choiceId);
      return true;
    }

    next() {
      if (this.index < this.questions.length - 1) {
        this.index += 1;
      }
      return this.current();
    }

    previous() {
      if (this.index > 0) {
        this.index -= 1;
      }
      return this.current();
    }

    finish() {
      this.finishedAt = new Date().toISOString();

      let correct = 0;
      for (const question of this.questions) {
        if (
          this.answers.get(question.question_id) ===
          question.correct_choice_id
        ) {
          correct += 1;
        }
      }

      const total = this.questions.length;

      return {
        total,
        answered: this.answers.size,
        correct,
        incorrect: Math.max(this.answers.size - correct, 0),
        unanswered: total - this.answers.size,
        percentage: total ? Math.round((correct / total) * 100) : 0,
        started_at: this.startedAt,
        finished_at: this.finishedAt
      };
    }
  }

  window.SSWQuestion = {
    SOURCE_TYPES,
    QUESTION_TYPES,
    STATUS,
    PREDICTED_LABEL,
    SOURCE_BASED_LABEL,
    normalizeQuestion,
    validateQuestion,
    QuestionStore,
    ExamSession
  };
})();
