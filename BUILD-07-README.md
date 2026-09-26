# BUILD-07 — Question Engine

This engine implements the locked question architecture.

## Three source types

1. OFFICIAL_SAMPLE
2. SOURCE_BASED_PRACTICE
3. PREDICTED_PRACTICE

## Mandatory provenance

Every question requires:
- fact_id
- source_id
- physical_page
- track
- category
- question type

## Four-choice rule

Every question must contain exactly four choices and exactly one
`correct_choice_id`.

## Official samples

Official samples are immutable and are never overwritten by generated variants.

## Generated practice

SOURCE-BASED PRACTICE is source-derived and clearly labelled.

PREDICTED PRACTICE is explicitly labelled:
`PREDICTED PRACTICE — NOT AN OFFICIAL EXAM QUESTION`

It must never be presented as an actual or guaranteed exam question.

## Visual questions

A VISUAL question is blocked unless the visual engine confirms that the
source image, exact topic relationship and visual-question eligibility are verified.

## Important

The current question population remains empty until verified fact-level records
are populated. The engine itself does not invent questions or source facts.
