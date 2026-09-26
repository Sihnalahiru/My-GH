# BUILD-03 — Source / Provenance Engine

This stage adds the provenance gate between the verified source registry and all
future study/question/media records.

## Canonical chain

OFFICIAL SOURCE
→ source_id
→ physical page
→ printed page (when applicable)
→ chapter
→ topic
→ fact
→ illustration
→ question
→ explanation
→ audio

## Promotion rule

A record cannot be VERIFIED unless its source provenance is valid.

Required:
- source_id
- positive physical_page
- registered source
- matching track
- verified source

Pending/blocked records remain outside the verified layer.

## Important

BUILD-03 does not invent study facts or questions. The current empty study and
question arrays are intentional and will be populated from the audited source
records in the later data-population stages.
