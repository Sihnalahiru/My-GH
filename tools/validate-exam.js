/* BUILD-10 — Real Exam Mode Validator */
(function () {
  "use strict";

  function validateRealExam() {
    const errors = [];
    const warnings = [];

    if (!window.SSWRealExam) {
      errors.push("EXAM-001: Real Exam engine is not loaded");
      return { valid: false, errors, warnings };
    }

    const config = window.SSWRealExam.EXAM_CONFIG;

    if (config.written.duration_minutes !== 45) {
      errors.push("EXAM-002: written duration configuration mismatch");
    }

    if (config.practical.duration_minutes !== 30) {
      errors.push("EXAM-003: practical duration configuration mismatch");
    }

    if (config.written.approximate_questions !== 30) {
      errors.push("EXAM-004: written approximate question configuration mismatch");
    }

    if (config.practical.approximate_questions !== 15) {
      errors.push("EXAM-005: practical approximate question configuration mismatch");
    }

    if (config.pass_threshold_percent !== 65) {
      errors.push("EXAM-006: pass threshold configuration mismatch");
    }

    if (config.listening_section !== false) {
      errors.push("EXAM-007: listening section must not be represented as official section");
    }

    if (config.explanations_during_exam !== false) {
      errors.push("EXAM-008: explanations must be disabled during exam");
    }

    if (config.hints_during_exam !== false) {
      errors.push("EXAM-009: hints must be disabled during exam");
    }

    if (config.answer_reveal_during_exam !== false) {
      errors.push("EXAM-010: answer reveal must be disabled during exam");
    }

    const written = new window.SSWRealExam.RealExamSession({
      section: window.SSWRealExam.SECTION_TYPES.WRITTEN
    });

    const sampleQuestion = {
      question_id: "TEST-Q001",
      track: "GROUND_HANDLING",
      source_type: "SOURCE_BASED_PRACTICE",
      question_type: "DIRECT",
      category: "SAFETY",
      fact_id: "TEST-F001",
      source: {
        source_id: "GH-01",
        physical_page: 6
      },
      question: {
        japanese: "TEST",
        english: "Test question",
        sinhala: "Test"
      },
      choices: [
        { choice_id: "A", english: "A" },
        { choice_id: "B", english: "B" },
        { choice_id: "C", english: "C" },
        { choice_id: "D", english: "D" }
      ],
      correct_choice_id: "B",
      status: "VERIFIED"
    };

    if (written.loadQuestions([sampleQuestion]) !== 1) {
      errors.push("EXAM-011: verified written question was not accepted");
    }

    written.start(1000000);

    if (written.remainingSeconds(1000000) !== 2700) {
      errors.push("EXAM-012: written timer calculation failed");
    }

    const answer = written.answer("B", 1000001);

    if (!answer.accepted) {
      errors.push("EXAM-013: answer acceptance failed");
    }

    const score = written.submit(1000002);

    if (!score || score.correct !== 1 || score.percentage !== 100) {
      errors.push("EXAM-014: score calculation failed");
    }

    const practical = new window.SSWRealExam.RealExamSession({
      section: window.SSWRealExam.SECTION_TYPES.PRACTICAL
    });

    if (practical.loadQuestions([sampleQuestion]) !== 0) {
      errors.push("EXAM-015: practical section accepted a question without visual_id");
    }

    warnings.push(
      "EXAM-W001: actual question population remains pending until verified question records are populated."
    );

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      policy: window.SSWRealExam.createExamPolicyModel()
    };
  }

  window.validateSSWRealExam = validateRealExam;
})();
