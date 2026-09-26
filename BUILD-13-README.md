# BUILD-13 — PWA / Offline

Status: VERIFIED

## Scope
- Web App Manifest
- Service Worker
- Offline application shell
- Same-origin runtime caching
- Separation of learner progress from official source data
- External official assets remain online-first

## Important source-integrity rule
This build does not invent or bundle external official PDFs, MP3s, or illustration URLs. The project remains compatible with the established online-first source architecture.

## Validation
Run:

```bash
node tools/validate-pwa.js
```

The validator checks the manifest, service worker lifecycle handlers, core files, and the external-asset cache boundary.
