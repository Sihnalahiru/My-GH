/* BUILD-05 — Visual Engine Validator */
(function () {
  "use strict";

  async function loadJSON(path) {
    const response = await fetch(path, { cache: "no-cache" });
    if (!response.ok) throw new Error(`${path}: ${response.status}`);
    return response.json();
  }

  async function validateVisualEngine() {
    const [illustrations, imageMap, topics, sources] =
      await Promise.all([
        loadJSON("data/illustrations.json"),
        loadJSON("data/image-map.json"),
        loadJSON("data/topics.json"),
        loadJSON("data/sources.json")
      ]);

    if (!window.SSWVisual) {
      throw new Error("BUILD-05 visual engine is not loaded.");
    }

    const store = new window.SSWVisual.VisualStore(
      illustrations,
      imageMap,
      topics,
      sources
    );

    const result = store.validate();

    const report = {
      build_step: "BUILD-05",
      status: result.valid ? "PASS" : "FAIL",
      counts: result.counts,
      map_count: imageMap.maps?.length || 0,
      errors: result.errors,
      warnings: result.warnings,
      rules: [
        "Page-qualified visual IDs are required.",
        "Source relationship must be verified before study use.",
        "Pending visual relationships cannot be used in verified visual questions.",
        "Official source visuals are separate from generated UI assets.",
        "Unclear visual relationships remain PENDING."
      ]
    };

    return report;
  }

  window.validateSSWVisual = validateVisualEngine;
})();
