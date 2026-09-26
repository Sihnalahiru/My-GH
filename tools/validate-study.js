/* BUILD-04 — Study Engine Validator */
(function () {
  "use strict";

  async function loadJSON(path) {
    const response = await fetch(path, { cache: "no-cache" });
    if (!response.ok) throw new Error(`${path}: ${response.status}`);
    return response.json();
  }

  async function validateStudyEngine() {
    const [sources, chapters, topics, study] = await Promise.all([
      loadJSON("data/sources.json"),
      loadJSON("data/chapters.json"),
      loadJSON("data/topics.json"),
      loadJSON("data/study.json")
    ]);

    if (!window.SSWProvenance || !window.SSWStudy) {
      throw new Error("BUILD-04 engines are not loaded.");
    }

    const provenance = new window.SSWProvenance.ProvenanceEngine(sources);
    const store = new window.SSWStudy.StudyStore(
      study, topics, chapters, sources, provenance
    );

    const report = {
      build_step: "BUILD-04",
      status: "PASS",
      counts: {
        study_blocks: store.blocks.length,
        verified: store.verified().length,
        pending: store.all({status: "PENDING"}).length
      },
      errors: [],
      warnings: []
    };

    const results = store.validateAll();
    for (const result of results) {
      if (!result.valid) {
        report.errors.push({
          study_id: result.study_id,
          errors: result.errors
        });
      }
      report.warnings.push(...(result.warnings || []).map(w => ({
        study_id: result.study_id, warning: w
      })));
    }

    // Every populated study block must reference a known topic and source.
    for (const record of store.blocks) {
      if (!store.topic(record.topic_id)) {
        report.errors.push({
          study_id: record.study_id,
          errors: ["STUDY-009: unknown topic_id"]
        });
      }
      if (!store.source(record.source_id)) {
        report.errors.push({
          study_id: record.study_id,
          errors: ["STUDY-010: unknown source_id"]
        });
      }
    }

    if (report.errors.length) report.status = "FAIL";

    return report;
  }

  window.validateSSWStudy = validateStudyEngine;
})();
