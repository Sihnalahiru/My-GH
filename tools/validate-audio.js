/* BUILD-08 — Audio Engine Validator */
(function () {
  "use strict";

  async function loadJSON(path) {
    const response = await fetch(path, { cache: "no-cache" });
    if (!response.ok) throw new Error(`${path}: ${response.status}`);
    return response.json();
  }

  async function validateAudioEngine() {
    const [audio, sources] = await Promise.all([
      loadJSON("data/audio.json"),
      loadJSON("data/sources.json")
    ]);

    if (!window.SSWAudio) {
      throw new Error("BUILD-08 audio engine is not loaded.");
    }

    const store = new window.SSWAudio.AudioStore(audio, sources);
    const result = store.validate();

    return {
      build_step: "BUILD-08",
      status: result.valid ? "PASS" : "FAIL",
      counts: result.counts,
      errors: result.errors,
      warnings: result.warnings,
      rules: [
        "Audio is presentation-layer media, not an independent source.",
        "Every audio block requires fact/source provenance.",
        "Japanese, English and Sinhala content are separate audio variants.",
        "Audio must preserve source meaning, numbers, units, operators and procedure order.",
        "Stop Voice support is mandatory.",
        "Block playback is the default.",
        "Queue playback is optional and controlled.",
        "No audio URL is invented.",
        "Pending audio remains pending.",
        "Browser SpeechSynthesis is not labelled Native Audio."
      ]
    };
  }

  window.validateSSWAudio = validateAudioEngine;
})();
