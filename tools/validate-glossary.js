/* BUILD-06 — Glossary / Terminology Validator */
(function () {
  "use strict";

  async function loadJSON(path) {
    const response = await fetch(path, { cache: "no-cache" });
    if (!response.ok) throw new Error(`${path}: ${response.status}`);
    return response.json();
  }

  async function validateGlossary() {
    const [glossary, sources] = await Promise.all([
      loadJSON("data/glossary.json"),
      loadJSON("data/sources.json")
    ]);

    if (!window.SSWGlossary) {
      throw new Error("BUILD-06 glossary engine is not loaded.");
    }

    const store = new window.SSWGlossary.GlossaryStore(
      glossary,
      sources
    );

    const result = store.validate();

    const report = {
      build_step: "BUILD-06",
      status: result.valid ? "PASS" : "FAIL",
      counts: result.counts,
      errors: result.errors,
      warnings: result.warnings,
      rules: [
        "Japanese terminology must be source-supported.",
        "No inferred Japanese terminology is promoted.",
        "VERIFIED terms require source_id and physical_page.",
        "VERIFIED substantive terms require Sinhala explanation.",
        "Track/source isolation is enforced.",
        "Pending terminology remains pending."
      ]
    };

    return report;
  }

  window.validateSSWGlossary = validateGlossary;
})();
