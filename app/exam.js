/* BUILD-10 — Real Exam Mode
 *
 * Exam simulation layer. It consumes verified question records.
 * It does not create or alter source facts/questions.
 */
(function () {
  "use strict";

  const EXAM_CONFIG = Object.freeze({
    mode: "REAL_EXAM",
    title: "SSW Airport Ground Handling Exam",
    written: {
      duration_minutes: 45,
      approximate_questions: 30
    },
    practical: {
      duration_minutes: 30,
      approximate_questions: 15
    },
    sections_required_individually: true,
    pass_threshold_percent: 65,
    listening_section: false,
    exam_language: "ja",
    explanations_during_exam: false,
    hints_during_exam: false,
    answer_reveal_during_exam: false
  });

  const SECTION_TYPES = Object.freeze({
    WRITTEN: "WRITTEN",
    PRACTICAL: "PRACTICAL"
  });

  const SESSION_STATUS = Object.freeze({
    READY: "READY",
    RUNNING: "RUNNING",
    SUBMITTED: "SUBMITTED",
    EXPIRED: "EXPIRED",
    ABANDONED: "ABANDONED"
  });

  function now() {
    return Date.now();
  }

  function normalizeExamQuestion(question) {
    return {
      question_id: question?.question_id || null,
      track: question?.track || null,
      source_type: question?.source_type || null,
      question_type: question?.question_type || null,
      category: question?.category || null,
      fact_id: question?.fact_id || null,
      source: question?.source || null,
      question: {
        japanese: question?.question?.japanese || "",
        english: question?.question?.english || "",
        sinhala: question?.question?.sinhala || ""
      },
      choices: Array.isArray(question?.choices)
        ? question.choices.map(choice => ({
            choice_id: choice.choice_id,
            japanese: choice.japanese || "",
            english: choice.english || "",
            sinhala: choice.sinhala || ""
          }))
        : [],
      correct_choice_id: question?.correct_choice_id || null,
      visual_id: question?.visual_id || null,
      status: question?.status || "DRAFT",
      official: question?.official === true,
      immutable: question?.immutable === true
    };
  }

  function isExamEligible(question, options = {}) {
    if (!question) return false;

    if (question.status !== "VERIFIED") return false;

    if (question.track !== "GROUND_HANDLING") return false;

    if (!question.fact_id) return false;

    if (!question.source?.source_id) return false;

    if (!Number.isInteger(question.source.physical_page) ||
        question.source.physical_page < 1) {
      return false;
    }

    if (!Array.isArray(question.choices) || question.choices.length !== 4) {
      return false;
    }

    if (!question.correct_choice_id) return false;

    if (options.section === SECTION_TYPES.PRACTICAL) {
      if (!question.visual_id) return false;
    }

    return true;
  }

  function createSectionConfig(type) {
    if (type === SECTION_TYPES.WRITTEN) {
      return {
        section: SECTION_TYPES.WRITTEN,
        title: "Written Examination",
        duration_minutes: EXAM_CONFIG.written.duration_minutes,
        approximate_questions: EXAM_CONFIG.written.approximate_questions
      };
    }

    if (type === SECTION_TYPES.PRACTICAL) {
      return {
        section: SECTION_TYPES.PRACTICAL,
        title: "Practical / Judgment Examination",
        duration_minutes: EXAM_CONFIG.practical.duration_minutes,
        approximate_questions: EXAM_CONFIG.practical.approximate_questions
      };
    }

    return null;
  }

  class RealExamSession {
    constructor(options = {}) {
      this.section = options.section || SECTION_TYPES.WRITTEN;
      this.config = createSectionConfig(this.section);
      this.session_id = options.session_id || `exam-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

      this.questions = [];
      this.index = 0;
      this.answers = new Map();

      this.status = SESSION_STATUS.READY;
      this.started_at = null;
      this.deadline_at = null;
      this.submitted_at = null;
      this.score = null;

      this.question_order_locked = true;
    }

    loadQuestions(questionList) {
      const list = Array.isArray(questionList)
        ? questionList.map(normalizeExamQuestion)
        : [];

      this.questions = list.filter(q =>
        isExamEligible(q, { section: this.section })
      );

      this.index = 0;
      this.answers.clear();

      return this.questions.length;
    }

    start(startTime = now()) {
      if (!this.config) {
        throw new Error("EXAM-001: invalid exam section");
      }

      if (!this.questions.length) {
        throw new Error("EXAM-002: no verified eligible questions loaded");
      }

      this.status = SESSION_STATUS.RUNNING;
      this.started_at = startTime;
      this.deadline_at =
        startTime + this.config.duration_minutes * 60 * 1000;

      return this.snapshot();
    }

    remainingMilliseconds(currentTime = now()) {
      if (this.status !== SESSION_STATUS.RUNNING) return 0;

      return Math.max(this.deadline_at - currentTime, 0);
    }

    remainingSeconds(currentTime = now()) {
      return Math.floor(
        this.remainingMilliseconds(currentTime) / 1000
      );
    }

    isExpired(currentTime = now()) {
      return (
        this.status === SESSION_STATUS.RUNNING &&
        currentTime >= this.deadline_at
      );
    }

    checkTime(currentTime = now()) {
      if (this.isExpired(currentTime)) {
        this.status = SESSION_STATUS.EXPIRED;
        this.submitted_at = currentTime;
      }

      return this.status;
    }

    current() {
      return this.questions[this.index] || null;
    }

    progress() {
      return {
        current: this.questions.length ? this.index + 1 : 0,
        total: this.questions.length,
        answered: this.answers.size,
        unanswered: Math.max(
          this.questions.length - this.answers.size,
          0
        )
      };
    }

    answer(choiceId, currentTime = now()) {
      this.checkTime(currentTime);

      if (this.status !== SESSION_STATUS.RUNNING) {
        return {
          accepted: false,
          reason: "EXAM_NOT_RUNNING"
        };
      }

      const question = this.current();

      if (!question) {
        return {
          accepted: false,
          reason: "NO_CURRENT_QUESTION"
        };
      }

      const choiceExists = question.choices.some(
        choice => choice.choice_id === choiceId
      );

      if (!choiceExists) {
        return {
          accepted: false,
          reason: "INVALID_CHOICE"
        };
      }

      this.answers.set(question.question_id, choiceId);

      return {
        accepted: true,
        question_id: question.question_id,
        choice_id: choiceId
      };
    }

    next(currentTime = now()) {
      this.checkTime(currentTime);

      if (this.status !== SESSION_STATUS.RUNNING) {
        return this.current();
      }

      if (this.index < this.questions.length - 1) {
        this.index += 1;
      }

      return this.current();
    }

    previous(currentTime = now()) {
      this.checkTime(currentTime);

      if (this.status !== SESSION_STATUS.RUNNING) {
        return this.current();
      }

      if (this.index > 0) {
        this.index -= 1;
      }

      return this.current();
    }

    jumpTo(index, currentTime = now()) {
      this.checkTime(currentTime);

      if (this.status !== SESSION_STATUS.RUNNING) return false;

      if (!Number.isInteger(index)) return false;

      if (index < 0 || index >= this.questions.length) return false;

      this.index = index;
      return true;
    }

    submit(currentTime = now()) {
      this.checkTime(currentTime);

      if (
        this.status !== SESSION_STATUS.RUNNING &&
        this.status !== SESSION_STATUS.EXPIRED
      ) {
        return this.score;
      }

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
      const answered = this.answers.size;
      const unanswered = total - answered;
      const percentage = total
        ? Math.round((correct / total) * 100)
        : 0;

      this.score = {
        section: this.section,
        total,
        answered,
        unanswered,
        correct,
        incorrect: Math.max(answered - correct, 0),
        percentage,
        passed: percentage >= EXAM_CONFIG.pass_threshold_percent,
        threshold_percent: EXAM_CONFIG.pass_threshold_percent,
        status: this.status === SESSION_STATUS.EXPIRED
          ? SESSION_STATUS.EXPIRED
          : SESSION_STATUS.SUBMITTED
      };

      if (this.status !== SESSION_STATUS.EXPIRED) {
        this.status = SESSION_STATUS.SUBMITTED;
      }

      this.submitted_at = currentTime;

      return this.score;
    }

    abandon(currentTime = now()) {
      if (this.status === SESSION_STATUS.RUNNING) {
        this.status = SESSION_STATUS.ABANDONED;
        this.submitted_at = currentTime;
      }

      return this.snapshot();
    }

    snapshot(currentTime = now()) {
      this.checkTime(currentTime);

      return {
        session_id: this.session_id,
        section: this.section,
        status: this.status,
        started_at: this.started_at,
        deadline_at: this.deadline_at,
        submitted_at: this.submitted_at,
        remaining_seconds: this.remainingSeconds(currentTime),
        progress: this.progress(),
        current_question_id: this.current()?.question_id || null,
        score: this.score
      };
    }
  }

  function createExamPolicyModel() {
    return {
      title: EXAM_CONFIG.title,
      written: { ...EXAM_CONFIG.written },
      practical: { ...EXAM_CONFIG.practical },
      sections_required_individually:
        EXAM_CONFIG.sections_required_individually,
      pass_threshold_percent: EXAM_CONFIG.pass_threshold_percent,
      listening_section: EXAM_CONFIG.listening_section,
      exam_language: EXAM_CONFIG.exam_language,
      explanations_during_exam:
        EXAM_CONFIG.explanations_during_exam,
      hints_during_exam: EXAM_CONFIG.hints_during_exam,
      answer_reveal_during_exam:
        EXAM_CONFIG.answer_reveal_during_exam
    };
  }

  window.SSWRealExam = {
    EXAM_CONFIG,
    SECTION_TYPES,
    SESSION_STATUS,
    normalizeExamQuestion,
    isExamEligible,
    createSectionConfig,
    createExamPolicyModel,
    RealExamSession
  };
})();
