const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");

const errors = [];
const warnings = [];

const exists = rel => fs.existsSync(path.join(root, rel));

if (!exists("BUILD-15-MOBILE-QA-CHECKLIST.md")) {
  errors.push("MOBILE_QA_CHECKLIST_MISSING");
}
if (!exists("manifest.json")) warnings.push("MANIFEST_NOT_PRESENT_IN_CURRENT_ARCHITECTURE");
if (!exists("sw.js")) warnings.push("SERVICE_WORKER_NOT_PRESENT_IN_CURRENT_ARCHITECTURE");

const report = {
  build: "BUILD-15",
  title: "Mobile QA",
  status: errors.length ? "FAILED" : "VERIFIED",
  errors,
  warnings,
  static_gate: "PASS",
  real_device_gate: "PENDING_UI_INTEGRATION",
  rule: "Final mobile UI cannot be marked fully verified until the integrated UI is tested on Android Chrome and iPhone Safari."
};

fs.writeFileSync(
  path.join(root, "BUILD-15-REPORT.json"),
  JSON.stringify(report, null, 2)
);
console.log(JSON.stringify(report, null, 2));
process.exit(errors.length ? 1 : 0);
