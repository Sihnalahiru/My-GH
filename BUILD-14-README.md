# BUILD-14 — Automated Validator

**Status: VERIFIED**

BUILD-14 is the cross-project QA gate for the current SSW Airport Ground Handling PWA architecture.

## What it validates
- Canonical data layer presence
- Engine module presence
- Individual validator presence
- JSON parseability
- Schema object validity
- Source registry ID uniqueness
- Ground Handling / Aircraft Maintenance track separation metadata
- Accidental duplication of source-like PDFs/audio/archives
- Promotion gate: unsupported or unverified source-derived content must not be promoted

## Intentional pending state
The verified study, glossary, question, answer and audio arrays may remain empty while source-derived population is pending. Empty is **not** treated as an error because inventing data would violate the project's source-of-truth rules.

The visual/UI shell is deferred until the dedicated UI integration stage. `index.html`, `styles.css`, and the final `app.js` shell are therefore not hard requirements for this architecture validator.

## Run

```bash
node tools/validate-all.js
```

The machine-readable result is written to:

`BUILD-14-REPORT.json`
