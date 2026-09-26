# BUILD-06 — Glossary / Terminology Engine

This layer manages source-supported technical terminology.

## Canonical record

Official source
→ source_id
→ physical page
→ Japanese technical term
→ furigana (when source provides it)
→ English meaning/source terminology
→ Sinhala explanation
→ status

## Rules

- Japanese terms are never inferred.
- A term without official source support remains PENDING.
- VERIFIED terms require source provenance.
- VERIFIED substantive terms require Sinhala explanation.
- GH and AM terminology remain isolated by track.
- Search covers Japanese, furigana, English, Sinhala, abbreviations and aliases.
- The engine does not generate language-name labels or flags.
- Pending terminology is not promoted to verified exam terminology.
