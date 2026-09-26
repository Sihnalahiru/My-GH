# BUILD-08 — Audio Engine

Audio is a presentation layer and is never an independent source of truth.

## Canonical chain

VERIFIED FACT
→ STUDY/QUESTION BLOCK
→ ja/en/si content
→ AUDIO_BLOCK
→ audio variant
→ playback
→ verification

## Audio rules

- Block-level playback is the default.
- Stop Voice immediately stops the current item and clears the queue.
- Queue playback is optional.
- Procedure audio is intended to be split by semantic step.
- Technical term + number/unit must not be split incorrectly.
- Warnings should remain distinct audio blocks.
- Audio cannot add unsupported information.
- Audio must preserve numbers, units, operators, conditions, exceptions and procedure order.
- No audio URL is invented.
- Pending audio remains pending.
- Browser SpeechSynthesis must never be called "Native Audio".
- Human recordings can be marked HUMAN_RECORDING after verification.
- Question/explanation audio can reference exact question IDs through source_content_id.
- Actual audio files are not created by this build step.
