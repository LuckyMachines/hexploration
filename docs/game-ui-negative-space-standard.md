# Game UI Negative Space and Readability Standard

Negative space is gameplay readability space. The interface must protect the player's view of the game world, the main action area, readable silhouettes, clear controls, and obvious information priority.

## Standard

1. Preserve the game object or action area as the strongest first-read element on the screen.
2. Keep persistent HUD minimal during active play.
3. Show only information needed for the current decision.
4. Push secondary info into menus, drawers, tabs, hover or tap details, and post-action screens.
5. Avoid filling every corner with labels, meters, badges, icons, buttons, panels, or decorative chrome.
6. Use calm space between high-information moments.
7. Keep active-play hierarchy clear: board, current choice, primary action, then optional detail.
8. Let animated or expressive elements support control feel without covering the board.
9. Do not show redundant state in multiple places at once unless the duplicate is essential for accessibility or safety.
10. Prefer progressive disclosure for telemetry, history, debug information, secondary stats, and narrative detail.

## Component Quality Bar

Every UI component must look intentionally designed, not merely functional. Components need considered padding, margin, gutters, borders, border radius, typography hierarchy, line height, letter spacing where appropriate, responsive behavior, overflow handling, and empty, loading, and error states.

Text must not visually overflow, clip, overlap, or escape its container unless explicitly designed to do so. Long labels, addresses, IDs, and dynamic strings must wrap, truncate, or move into detail surfaces.

## Active-Play Checklist

Before shipping a game UI change, confirm:

1. The board or toy remains visually dominant.
2. The player can identify the current actionable control without scanning every panel.
3. Secondary information is hidden until requested or until the current state makes it relevant.
4. The HUD still works at mobile and desktop widths.
5. No text clips, overlaps, or escapes its container.
6. The screen has quiet areas around the main action, especially during idle or planning states.

