/* BUILD-07 — Question Engine Validator */
(function () {
  "use strict";

  async function loadJSON(path) {
    const response = await fetch(path, { cache: "no-cache" });
    if (!response.ok) throw new Error(`${path}: ${response.status}`);
    return response.json();
  }

  async function validateQuestionEngine() {
    const [questions, sources, illustrations] = await Promise.all([
      loadJSON("data/questions.json"),
      loadJSON("data/sources.json"),
      loadJSON("data/illustrations.json")
    ]);

    if (!window.SSWQuestion || !window.SSWVisual) {
      throw new Error("BUILD-07 dependencies are not loaded.");
    }

    const visualStore = new window.SSWVisual.VisualStore(
      illustrations,
      { maps: [] },
      { topics: [] },
      sources
    );

    const store = new window.SSWQuestion.QuestionStore(
      questions,
      sources,
      visualStore
    );

    const result = store.validate();

    return {
      build_step: "BUILD-07",
      status: result.valid ? "PASS" : "FAIL",
      counts: result.counts,
      errors: result.errors,
      warnings: result.warnings,
      source_types: Object.values(window.SSWQuestion.SOURCE_TYPES),
      question_types: window.SSWQuestion.QUESTION_TYPES,
      rules: [
        "Exactly four choices per question.",
        "Exactly one correct_choice_id.",
        "Official samples are immutable and separate.",
        "Source-based practice is explicitly labelled SOURCE-BASED PRACTICE.",
        "Predicted practice is explicitly labelled PREDICTED PRACTICE — NOT AN OFFICIAL EXAM QUESTION.",
        "Every question requires fact_id and source/page provenance.",
        "Visual questions require verified visual eligibility.",
        "No question is promoted when provenance/QA fails."
      ]
    };
  }

  window.validateSSWQuestions = validateQuestionEngine;
})();
