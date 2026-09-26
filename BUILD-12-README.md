# BUILD-12 — Progress / Analytics

BUILD-12 adds the learner-state and analytics layer without changing any
source-of-truth study data.

## Separation rule

Progress is runtime learner data. It is intentionally separate from:

- `data/sources.json`
- `data/curriculum.json`
- `data/chapters.json`
- `data/topics.json`
- `data/study.json`
- `data/questions.json`
- `data/answers.json`
- `data/illustrations.json`
- `data/glossary.json`

The progress engine never edits those files.

## Runtime state

Default browser storage key:

`ssw-gh-progress-v1`

State contains:

- learner events
- completed sessions
- timestamps
- question correctness
- study duration
- topic/chapter references
- visual/glossary/audio activity

No learner history is bundled into the repository.

## Analytics

The engine derives:

- total study minutes
- completed study blocks
- questions answered
- correct / incorrect answers
- MCQ accuracy
- current active-day streak
- total active days
- daily activity trend
- weekly activity trend
- topic-level accuracy
- chapter-level accuracy
- weak areas
- source/activity breakdown
- last activity timestamp

Weak-area detection is deliberately conservative: by default a topic needs
at least 3 answered questions before it is considered a weak area.

## Supported event types

- `STUDY_OPEN`
- `STUDY_COMPLETE`
- `MCQ_ANSWER`
- `EXAM_COMPLETE`
- `VISUAL_VIEW`
- `GLOSSARY_VIEW`
- `AUDIO_PLAY`

## Source integrity

Progress records may reference verified IDs such as `question_id`, `topic_id`,
`chapter_id`, `study_id`, `visual_id`, `term_id`, `source_id`, and `physical_page`,
but they do not create or alter those source records.

## Reset

`ProgressStore.reset()` clears learner progress only. It does not delete or
modify master source data.

## Validation

Run:

```bash
node tools/validate-progress.js
```

The validator checks schema availability, state normalization, event types,
and representative event/session normalization.
