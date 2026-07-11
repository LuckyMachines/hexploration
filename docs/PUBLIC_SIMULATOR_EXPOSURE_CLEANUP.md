# Public Simulator Exposure Cleanup

## Goal

Keep the player-facing promise clean: `xenovoya.com` teaches Xenovoya, `play.xenovoya.com` launches the real client, and simulator or growth-loop previews stay internal. Public users should not see internal scenario ids, engine workbench language, scenario tuning language, or development process surfaces.

## Sequential Implementation Plan

1. Define the public contract: marketing teaches the game, the live client is the playable experience, and simulator/growth-loop routes are internal only.
2. Add route classifications for public, live-client, internal-tool, dev-only, and noindex surfaces.
3. Reclassify `/simulator` as internal tooling.
4. Reclassify simulator topics as internal tooling or remove them from public route generation.
5. Reclassify growth-loop `/play` as an internal preview unless it is the actual live game client.
6. Reclassify scenario preview pages as internal unless they describe real player-facing live-game starts.
7. Remove raw internal scenario ids from public sitemap, route indexes, metadata indexes, social preview checks, and LLM text.
8. Remove simulator workbench routes from public sitemap, route indexes, metadata indexes, social preview checks, and LLM text.
9. Replace player-facing CTAs that point to internal preview routes with the live client URL.
10. Keep direct internal routes working locally when explicitly enabled.
11. Add a `VITE_ENABLE_INTERNAL_TOOLS` flag for local/internal access.
12. Block or redirect internal routes when the flag is not enabled.
13. Keep internal e2e coverage able to opt into internal routes with the flag.
14. Split player-facing browser tests from internal-tool browser tests.
15. Rename tests and assertions that describe the growth-loop preview as public play.
16. Audit header, footer, homepage, game guide, and completion surfaces for simulator-as-product language.
17. Audit route metadata and SEO helpers for simulator, same-engine, and raw scenario id leakage.
18. Audit generated public assets for stale internal routes.
19. Add regression tests for public SEO assets and rendered public copy.
20. Add browser tests proving launch CTAs point to the live client.
21. Add browser tests proving internal routes are blocked in production-mode runs.
22. Add browser tests proving internal routes work when the internal flag is enabled.
23. Document the public/internal boundary and completion evidence.
24. Run builds, unit tests, focused browser tests, public asset scans, and whitespace checks.

## Acceptance Criteria

- Public navigation and homepage CTAs point to the live client, not the growth-loop preview.
- Public sitemap and LLM text do not include simulator routes, simulator topics, or raw internal scenario ids.
- Public metadata and route indexes do not include simulator routes, simulator topics, or raw internal scenario ids.
- `/simulator`, `/play`, `/challenge`, `/replay`, `/scenarios`, `/create-scenario`, and `/devlog` are blocked when internal tools are not enabled.
- Internal routes still render in local/internal mode.
- Tests cover both production-mode blocking and internal-mode access.
- No player-facing generated artifact leaks simulator workbench language or raw internal scenario ids.
