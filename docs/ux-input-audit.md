# UX Input and Assistive-Mode Audit

Review date: 2026-09-08

Automated coverage runs through `npm run ux:input`, `npm run ux:assistive`, and `npm run ux:touch`:

- Keyboard-only skip navigation and starter completion
- Visible programmatic focus through the full decision path
- 200% text at a 320 CSS-pixel equivalent viewport without horizontal page scrolling
- Windows forced-colors rendering with system colors
- Reduced-motion rendering with no continuously running interface animation
- Serious and critical axe findings in the forced-colors state
- Landmark, heading-order, accessible-name, and live-region semantics in Chromium, Firefox, and WebKit
- Modal focus entry, Escape dismissal, and focus restoration in Chromium, Firefox, and WebKit
- Tap-only starter completion on Pixel 7 and iPhone 13 browser profiles
- 44 px interactive targets, narrow-screen overflow, modal close sizing, and destructive confirmation on both mobile profiles

Before release, complete the following hardware checks because browser automation cannot prove physical usability:

- [ ] Windows keyboard: Tab, Shift+Tab, Enter, Space, Escape, arrow keys
- [ ] macOS keyboard with full keyboard access enabled
- [ ] Touch-only phone: scroll, target selection, modal dismissal, board pan, pinch zoom
- [ ] Mouse: board rotate, pan, zoom, selection, cancel, and reset camera
- [ ] Trackpad: two-finger scroll, pinch zoom, and accidental gesture resistance
- [ ] Screen reader: NVDA + Firefox or Chrome
- [ ] Screen reader: VoiceOver + Safari on iOS
- [ ] 400% browser zoom on one critical game state

Record device, browser, assistive technology, task, result, recovery, and issue severity. Never mark these manual checks complete from an emulator or DOM-semantic audit alone.
