const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const required = [
  "manifest.json",
  "sw.js",
  "index.html",
  "data/progress-schema.json",
  "data/sources.json",
  "data/curriculum.json",
  "data/chapters.json",
  "data/topics.json"
];

const missing = required.filter(p => !fs.existsSync(path.join(root, p)));
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");

const checks = {
  manifest_present: fs.existsSync(path.join(root, "manifest.json")),
  service_worker_present: fs.existsSync(path.join(root, "sw.js")),
  manifest_name: typeof manifest.name === "string" && manifest.name.length > 0,
  manifest_start_url: typeof manifest.start_url === "string",
  manifest_scope: typeof manifest.scope === "string",
  manifest_standalone: manifest.display === "standalone",
  service_worker_install: sw.includes('addEventListener("install"'),
  service_worker_activate: sw.includes('addEventListener("activate"'),
  service_worker_fetch: sw.includes('addEventListener("fetch"'),
  external_assets_not_forced_into_cache: sw.includes("url.origin !== self.location.origin")
};

const errors = missing.map(p => `MISSING: ${p}`);
for (const [k,v] of Object.entries(checks)) if (!v) errors.push(`FAILED: ${k}`);

const report = {
  build: "BUILD-13",
  title: "PWA / Offline",
  status: errors.length ? "FAILED" : "VERIFIED",
  errors,
  checks,
  cache_strategy: {
    app_shell: "precache same-origin core application shell",
    same_origin_runtime: "cache-first after first successful fetch",
    external_official_assets: "online-first; not fabricated or bundled by this build",
    learner_progress: "local runtime storage; independent of official source data"
  }
};

fs.writeFileSync(
  path.join(root, "BUILD-13-REPORT.json"),
  JSON.stringify(report, null, 2)
);

console.log(JSON.stringify(report, null, 2));
process.exit(errors.length ? 1 : 0);
