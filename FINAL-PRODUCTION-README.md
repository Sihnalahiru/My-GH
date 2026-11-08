# SSW Airport Ground Handling — Final Production Candidate

Safari-first, mobile portrait PWA for the audited Japan SSW Airport Ground Handling study project.

## Included
- Unified Ground Handling Study / MCQ / Exam / Audio / Progress analytics
- Aircraft Maintenance Extra Syllabus library: AM Books 1–3, original PDFs and 196 audited source images
- Aircraft Maintenance PDF viewer and per-book source image gallery
- Animated dashboard slots for airport arrival, achievements and travel profile
- Premium aviation dashboard
- Dark Mode
- Comfort View
- Reduced Motion
- Portrait-first mobile layout and landscape guidance
- iOS safe-area handling
- Safari Add to Home Screen guidance
- Offline service worker shell
- Source-traceable official study data

## Safari use
Open the deployed site in Safari. For app-like mode use **Share → Add to Home Screen**. The manifest and Apple touch icon are included.

## QA gates
Static build validation passes. Physical iPhone Safari and Android Chrome testing still requires the deployed URL on real devices. GitHub Pages live verification requires pushing the package to the intended repository.

Human/native recordings remain pending by design; browser voice is only the configured fallback.

## Aircraft Maintenance Extra Syllabus

The app loads `data/aircraft-maintenance.json`, which points to the original AM Book 1–3 PDFs, exact image filenames and audit reports in `Sihnalahiru/SSW-ReadyToFly`. The books remain separate. Pixel matching is not treated as proof of semantic topic mapping.

## Dashboard animations

Place the three supplied files at `assets/animations/Airplane arrival at airport.lottie`, `assets/animations/Trophy.lottie`, and `assets/animations/Passports in pink and blue.lottie`. The dashboard references these paths. Service-worker caching treats them as optional so a missing animation does not prevent app installation.
