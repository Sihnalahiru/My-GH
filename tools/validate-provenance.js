/* BUILD-03 — Provenance Validation Runner */
(function () {
  "use strict";

  async function loadJSON(path) {
    const response = await fetch(path, { cache: "no-cache" });
    if (!response.ok) {
      throw new Error(`Unable to load ${path}: ${response.status}`);
    }
    return response.json();
  }

  async function validateMasterProvenance() {
    const [sources, study, questions, answers, illustrations] =
      await Promise.all([
        loadJSON("data/sources.json"),
        loadJSON("data/study.json"),
        loadJSON("data/questions.json"),
        loadJSON("data/answers.json"),
        loadJSON("data/illustrations.json")
      ]);

    const engine = new window.SSWProvenance.ProvenanceEngine(sources);

    const report = {
      build_step: "BUILD-03",
      status: "PASS",
      checks: [],
      errors: [],
      warnings: []
    };

    function check(name, pass, detail = "") {
      report.checks.push({ name, pass, detail });
      if (!pass) report.errors.push({ name, detail });
    }

    check(
      "Source registry exists",
      Array.isArray(sources.sources) && sources.sources.length > 0
    );

    check(
      "Study records do not bypass provenance",
      Array.isArray(study.study_blocks)
    );

    check(
      "Question records do not bypass provenance",
      Array.isArray(questions.questions)
    );

    check(
      "Answer records are separated",
      Array.isArray(answers.answers)
    );

    check(
      "Illustration registry exists",
      Array.isArray(illustrations.illustrations)
    );

    // Validate any currently populated study records.
    for (const record of study.study_blocks) {
      const result = engine.validate(record);
      check(
        `Study provenance ${record.study_id || record.fact_id || "UNKNOWN"}`,
        result.valid,
        result.errors.join("; ")
      );
    }

    // Validate any currently populated questions.
    for (const record of questions.questions) {
      const result = engine.validate(record);
      check(
        `Question provenance ${record.question_id || "UNKNOWN"}`,
        result.valid,
        result.errors.join("; ")
      );

      if (record.status === "VERIFIED" && !engine.canPromote(record)) {
        check(
          `Verified question promotion ${record.question_id || "UNKNOWN"}`,
          false,
          "PROV-008: verified question failed promotion gate"
        );
      }
    }

    // Validate visual source references.
    for (const visual of illustrations.illustrations) {
      const source = engine.source(visual.source_id);
      check(
        `Visual source ${visual.visual_id}`,
        Boolean(source),
        source ? "" : `PROV-009: unknown source ${visual.source_id}`
      );

      if (source && visual.track && visual.track !== source.track) {
        check(
          `Visual track isolation ${visual.visual_id}`,
          false,
          "PROV-010: visual track/source mismatch"
        );
      }
    }

    // Empty question/study layers are expected at BUILD-03.
    if (study.study_blocks.length === 0) {
      report.warnings.push(
        "Study fact population is not yet loaded; no source facts were invented."
      );
    }

    if (questions.questions.length === 0) {
      report.warnings.push(
        "Question population is not yet loaded; BUILD-03 only enforces provenance."
      );
    }

    if (report.errors.length) {
      report.status = "FAIL";
    }

    return report;
  }

  window.validateSSWProvenance = validateMasterProvenance;
})();
