# FINAL PHASE C — Block-Based Audio / Voice Integration

This phase binds every verified study fact to a source-backed AUDIO_BLOCK.

## Rules
- Audio is a presentation layer, never a new source of truth.
- Each block keeps fact_id, source_id and physical page.
- Three text variants are preserved per block.
- Block-only playback is mandatory.
- Stop Voice cancels current playback and queue.
- Human/native-quality recordings are preferred for final production.
- Browser SpeechSynthesis is a fallback only and is never labelled Native Audio.
- No fabricated audio URLs are added.
- PENDING_AUDIO is not treated as VERIFIED.

## Current state
- 39 source-backed study audio blocks
- 117 language variants
- 0 fabricated audio files
- 0 VERIFIED recordings
- Browser voice fallback enabled
- Human recording status remains PENDING_AUDIO

## Validation
Run:
`node tools/validate-final-phase-c.js`
