const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const errors = [];
const warnings = [];

const exists = p => fs.existsSync(path.join(root, p));
const read = p => fs.readFileSync(path.join(root, p), "utf8");

if (!exists(".github/workflows/pages.yml")) errors.push("PAGES_WORKFLOW_MISSING");
if (!exists("BUILD-16-README.md")) errors.push("BUILD_16_README_MISSING");
if (!exists("data/deployment.json")) errors.push("DEPLOYMENT_CONFIG_MISSING");

if (exists(".github/workflows/pages.yml")) {
  const yml = read(".github/workflows/pages.yml");
  const checks = {
    checkout: yml.includes("actions/checkout@v4"),
    configure_pages: yml.includes("actions/configure-pages@v5"),
    upload_artifact: yml.includes("actions/upload-pages-artifact@v3"),
    deploy_pages: yml.includes("actions/deploy-pages@v4"),
    pages_write: yml.includes("pages: write"),
    id_token: yml.includes("id-token: write"),
    main_branch: yml.includes('branches: ["main"]')
  };
  for (const [k,v] of Object.entries(checks)) if (!v) errors.push(`WORKFLOW_CHECK_FAILED: ${k}`);
}

if (exists("data/deployment.json")) {
  try {
    const d = JSON.parse(read("data/deployment.json"));
    if (d.deployment_method !== "GitHub Actions") errors.push("DEPLOYMENT_METHOD_MISMATCH");
    if (d.artifact_path !== ".") errors.push("ARTIFACT_PATH_MISMATCH");
    if (d.path_strategy !== "relative") errors.push("PATH_STRATEGY_MISMATCH");
    if (d.live_deployment_verified !== false)
      warnings.push("LIVE_DEPLOYMENT_FLAG_NOT_PENDING");
  } catch (e) {
    errors.push("DEPLOYMENT_JSON_INVALID");
  }
}

// Detect root-absolute local resource references in the HTML/CSS/JS files.
// Such paths can break on GitHub project Pages.
const textFiles = [];
for (const rel of ["index.html","styles.css","sw.js"]) {
  if (exists(rel)) textFiles.push(rel);
}
const rootAbsolute = [];
for (const rel of textFiles) {
  const t = read(rel);
  // Ignore protocol URLs, hashes, and data URLs. Detect /foo local-style references.
  for (const m of t.matchAll(/["'(](\/(?!\/|https?:|#)[^"' )]+)["')]/g)) {
    rootAbsolute.push(`${rel}: ${m[1]}`);
  }
}
if (rootAbsolute.length) {
  warnings.push("ROOT_ABSOLUTE_LOCAL_REFERENCES_REVIEW_REQUIRED");
}

const report = {
  build: "BUILD-16",
  title: "GitHub Pages Deployment",
  status: errors.length ? "FAILED" : "VERIFIED",
  errors,
  warnings,
  deployment_architecture: "VERIFIED",
  live_site: "PENDING_REPOSITORY_PUSH",
  checks: {
    workflow_present: exists(".github/workflows/pages.yml"),
    deployment_config_present: exists("data/deployment.json"),
    root_absolute_reference_count: rootAbsolute.length,
    root_absolute_references: rootAbsolute
  }
};

fs.writeFileSync(
  path.join(root, "BUILD-16-REPORT.json"),
  JSON.stringify(report, null, 2)
);

console.log(JSON.stringify(report, null, 2));
process.exit(errors.length ? 1 : 0);
