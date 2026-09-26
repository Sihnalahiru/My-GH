const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const errors = [];
const warnings = [];
const results = {};

const exists = rel => fs.existsSync(path.join(root, rel));
const read = rel => fs.readFileSync(path.join(root, rel), "utf8");
function loadJSON(rel) {
  try { return JSON.parse(read(rel)); }
  catch (e) { errors.push(`INVALID_JSON: ${rel}: ${e.message}`); return null; }
}

function requiredFiles(label, list) {
  const missing = list.filter(x => !exists(x));
  results[label] = { required: list.length, missing };
  if (missing.length) missing.forEach(x => errors.push(`MISSING: ${x}`));
}

function optionalFiles(label, list) {
  const missing = list.filter(x => !exists(x));
  results[label] = { expected_later: list.length, missing };
  if (missing.length) warnings.push(`DEFERRED_UI_FILE: ${missing.join(", ")}`);
}

// Architecture files that must exist before UI implementation.
requiredFiles("data_layer", [
  "data/sources.json","data/curriculum.json","data/chapters.json","data/topics.json",
  "data/study.json","data/illustrations.json","data/image-map.json","data/glossary.json",
  "data/questions.json","data/answers.json","data/licenses/assets.json",
  "data/study-schema.json","data/illustration-schema.json","data/glossary-schema.json",
  "data/question-schema.json","data/audio-schema.json","data/audio.json",
  "data/navigation-schema.json","data/exam-schema.json","data/study-mode-schema.json",
  "data/progress-schema.json"
]);

requiredFiles("engine_modules", [
  "app/provenance.js","app/study.js","app/visual.js","app/glossary.js",
  "app/questions.js","app/audio.js","app/dashboard.js","app/exam.js",
  "app/study-mode.js","app/progress.js"
]);

requiredFiles("layer_validators", [
  "tools/validate-provenance.js","tools/validate-study.js","tools/validate-visual.js",
  "tools/validate-glossary.js","tools/validate-questions.js","tools/validate-audio.js",
  "tools/validate-dashboard.js","tools/validate-exam.js","tools/validate-study-mode.js",
  "tools/validate-progress.js","tools/validate-pwa.js","tools/validate-all.js"
]);

// UI shell is intentionally deferred until the later UI integration phase.
optionalFiles("ui_shell_deferred_until_ui_integration", [
  "index.html","styles.css","app.js","manifest.json","sw.js"
]);

// Parse all canonical JSON data files.
const jsonFiles = [
  "data/sources.json","data/curriculum.json","data/chapters.json","data/topics.json",
  "data/study.json","data/illustrations.json","data/image-map.json","data/glossary.json",
  "data/questions.json","data/answers.json","data/licenses/assets.json","data/audio.json"
];
const jsonStatus = {};
for (const f of jsonFiles) {
  if (!exists(f)) continue;
  const x = loadJSON(f);
  jsonStatus[f] = { parsed: x !== null, root_type: Array.isArray(x) ? "array" : typeof x };
}
results.json_parse = jsonStatus;

// Source registry: unique IDs and track separation.
if (exists("data/sources.json")) {
  const sources = loadJSON("data/sources.json");
  if (Array.isArray(sources)) {
    const ids = new Set();
    const tracks = {};
    for (const s of sources) {
      if (!s || typeof s !== "object") { errors.push("SOURCE_RECORD_NOT_OBJECT"); continue; }
      if (!s.source_id) errors.push("SOURCE_MISSING_ID");
      else if (ids.has(s.source_id)) errors.push(`DUPLICATE_SOURCE_ID: ${s.source_id}`);
      else ids.add(s.source_id);
      if (s.track) tracks[s.track] = (tracks[s.track] || 0) + 1;
    }
    results.source_integrity = { count: sources.length, unique_ids: ids.size, tracks };
  }
}

// No source-like media should be accidentally copied into the repository architecture.
const sourceExts = new Set([".pdf",".mp3",".wav",".m4a",".zip"]);
const bundled = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, {withFileTypes:true})) {
    if (e.name === ".git" || e.name === "node_modules") continue;
    const p = path.join(dir,e.name);
    if (e.isDirectory()) walk(p);
    else if (sourceExts.has(path.extname(e.name).toLowerCase())) bundled.push(path.relative(root,p));
  }
})(root);
results.source_asset_duplication = { count: bundled.length, files: bundled };
if (bundled.length) warnings.push("SOURCE_ASSET_DUPLICATION_REVIEW_REQUIRED");

// Verify schema files parse as objects.
const schemas = [
  "data/study-schema.json","data/illustration-schema.json","data/glossary-schema.json",
  "data/question-schema.json","data/audio-schema.json","data/navigation-schema.json",
  "data/exam-schema.json","data/study-mode-schema.json","data/progress-schema.json"
];
for (const f of schemas) {
  if (!exists(f)) continue;
  const x = loadJSON(f);
  if (!x || Array.isArray(x) || typeof x !== "object") errors.push(`SCHEMA_NOT_OBJECT: ${f}`);
}

// Validate intentionally empty verified-data layers without treating emptiness as fabrication.
const emptyAllowed = ["data/study.json","data/glossary.json","data/questions.json","data/answers.json","data/audio.json"];
for (const f of emptyAllowed) {
  if (!exists(f)) continue;
  const x = loadJSON(f);
  if (Array.isArray(x) && x.length === 0) {
    warnings.push(`DATA_POPULATION_PENDING: ${f}`);
  }
}

results.promotion_gate = {
  rule: "No unsupported or unverified source-derived content may be promoted.",
  empty_layers_allowed: true,
  pending_layers: emptyAllowed.filter(f => exists(f) && Array.isArray(loadJSON(f)) && loadJSON(f).length === 0)
};

const report = {
  build: "BUILD-14",
  title: "Automated Validator",
  status: errors.length ? "FAILED" : "VERIFIED",
  errors,
  warnings,
  results,
  note: "BUILD-14 validates the current architecture. UI shell files are intentionally deferred until the UI integration stage and therefore are warnings, not failures.",
  source_integrity_rule: "Official JAEA source material remains the source of truth; missing/unsupported data stays pending rather than being invented."
};

fs.writeFileSync(path.join(root, "BUILD-14-REPORT.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(errors.length ? 1 : 0);
