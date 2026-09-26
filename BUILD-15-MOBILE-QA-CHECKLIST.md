# BUILD-15 — Mobile QA Checklist

## Static QA
- [x] PWA manifest exists
- [x] Service Worker exists
- [x] 192px and 512px icons exist
- [ ] Final UI viewport meta — verify after UI integration
- [ ] Responsive breakpoints — verify after UI integration
- [ ] No horizontal overflow — verify on real devices
- [ ] Touch target sizing — verify on real devices
- [ ] Safe-area handling — verify on iPhone
- [ ] Sticky/fixed controls do not cover content
- [ ] MCQ controls remain usable at 320px–430px widths
- [ ] Real Exam timer and navigation remain usable on mobile
- [ ] Visual questions fit portrait viewport
- [ ] Audio controls remain reachable
- [ ] Dashboard cards do not overflow
- [ ] Glossary/search fields remain usable with mobile keyboard
- [ ] Offline launch tested in Android Chrome
- [ ] Offline launch tested in iPhone Safari/PWA
- [ ] Add-to-home-screen/install flow tested

## Required real-device matrix
1. Android Chrome — 360×800 or similar
2. Android Chrome — 412×915 or similar
3. iPhone Safari — 375×812 or similar
4. iPhone Safari — 390×844 or similar
5. Desktop Chrome/Edge responsive emulation

## Status rule
Do not mark the final mobile UI as VERIFIED until the UI integration build exists and these real-device checks are performed.
