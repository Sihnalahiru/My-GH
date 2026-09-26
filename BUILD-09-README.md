# BUILD-09 — Dashboard / Navigation Engine

This build creates the navigation and dashboard orchestration layer.

## Primary navigation

- Ground Handling Exam / Home
- Study
- MCQ Practice
- Official Samples
- Visual Library
- Technical Terms
- Search
- Progress
- Real Exam Mode

## Dashboard

The dashboard model supports:
- progress
- quick actions
- study tracks
- recent activity
- recommended next action
- navigation

## Architecture rule

This layer does not create, modify, translate, or invent source facts.
It only consumes verified master-data/progress models.

Visual styling, detailed HTML components, responsive CSS, and full screen
implementation are separate UI work and are not silently substituted here.
