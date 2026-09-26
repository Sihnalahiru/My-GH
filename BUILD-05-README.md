# BUILD-05 — Visual Engine

The Visual Engine connects verified official illustrations to the exact topic
they belong to.

## Core chain

Official PDF → physical page → figure/image → visual_id → topic → study display

## Protection

A visual cannot be used in a verified visual question unless:
1. its source is registered,
2. its exact topic relationship is verified,
3. its visual status is VERIFIED,
4. `visual_question_eligible` is explicitly true.

## Asset distinction

Official source illustrations, extracted assets, generated UI graphics and
third-party licensed assets are different classes. The engine does not treat
a UI image as an official source illustration.

## Pending

Pixel-level extraction and any unresolved image relationship remain pending.
The engine does not guess those relationships.
