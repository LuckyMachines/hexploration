# SEO, Growth, And Discovery Automation Implementation Plan

This plan turns Xenovoya's scenario, simulator, and growth systems into a self-updating discovery surface without manual page-by-page intervention.

## Superpower

Every playable scenario, public report, challenge, and design update should automatically become a well-described, crawlable, shareable, and measurable discovery asset.

## Sequential Implementation

1. Define the growth goal as shared completed runs per week.
2. Treat search discovery, social sharing, and no-JavaScript crawlers as first-class public surfaces.
3. Keep private, per-wallet, local-debug, replay-payload, and internal lab routes out of the crawlable index.
4. Create a written SEO/growth standard for metadata, canonical URLs, structured data, freshness, and artifact generation.
5. Create a public route registry that is the source of truth for indexable pages.
6. Register all permanent public routes: home, simulator, play, challenge, scenarios, progress, devlog, and creator.
7. Register scenario detail routes from the growth scenario catalog.
8. Register discovery topic pages from scenario tags and product vocabulary.
9. Register private route patterns separately from public routes.
10. Normalize route paths so sitemap, canonical, and runtime head logic agree.
11. Normalize the public site URL from environment configuration with a stable production fallback.
12. Add canonical URL builders that remove duplicate slashes and reject local hostnames in strict mode.
13. Add title builders with a consistent brand suffix.
14. Add description builders with length limits and fallback copy.
15. Add Open Graph builders for share previews.
16. Add Twitter card builders for share previews.
17. Add JSON-LD builders for WebSite, VideoGame, BreadcrumbList, and scenario pages.
18. Add metadata validation for title, description, canonical URL, indexability, and structured data.
19. Add duplicate-title and duplicate-description checks.
20. Add noindex checks for private route patterns.
21. Add route-to-route related content links for scenarios and discovery topics.
22. Add scenario detail pages with the same scenario catalog used by the playable app.
23. Add discovery topic pages that group scenarios by theme and player intent.
24. Add runtime head updates so SPA navigation updates title, description, canonical, OG, Twitter, and JSON-LD.
25. Keep persistent UI minimal on public pages and let the game/simulator content remain the visual priority.
26. Generate `sitemap.xml` from the route registry.
27. Generate `robots.txt` from the route registry and sitemap URL.
28. Generate `llms.txt` so AI and assistant-style discovery can understand the project.
29. Generate a public route index JSON artifact for debugging and future integrations.
30. Generate a latest SEO summary JSON artifact for dashboards.
31. Generate a latest SEO summary Markdown artifact for human review.
32. Generate a strict SEO report under `reports/seo`.
33. Publish a public copy of the latest SEO report under `app/public/seo`.
34. Generate social preview validation output for each route.
35. Generate next-action recommendations from failed or weak SEO checks.
36. Add `seo:generate` for artifact generation.
37. Add `seo:test` for metadata unit tests.
38. Add `seo:doctor` for strict validation without changing source logic.
39. Add `growth:seo` as the one-command automated growth/discovery preflight.
40. Keep reports ignored while committing deployable public artifacts.
41. Add unit tests for canonical URL normalization.
42. Add unit tests for scenario JSON-LD.
43. Add unit tests for route metadata validity.
44. Add unit tests for noindex route handling.
45. Add unit tests for generated descriptions and title length.
46. Validate generated sitemap URLs are absolute.
47. Validate sitemap excludes private routes.
48. Validate robots references the generated sitemap.
49. Validate public route index has no duplicate paths.
50. Validate every public route has a unique canonical URL.
51. Validate every scenario can be reached through a stable detail route.
52. Validate every discovery topic links to at least one scenario when possible.
53. Validate social previews have title, description, image, and URL.
54. Validate structured data parses as JSON objects.
55. Add route priority and change frequency hints.
56. Add freshness timestamps to generated artifacts.
57. Add public report summaries that can be consumed without running the app.
58. Add crawl-safe copy for simulator and evidence pages.
59. Add crawl-safe copy for challenge and play pages.
60. Add crawl-safe copy for scenario pages.
61. Add crawl-safe copy for topic pages.
62. Add related scenarios to scenario pages.
63. Add related topics to scenario pages.
64. Add scenario links to topic pages.
65. Add challenge links to scenario pages.
66. Add play links to scenario pages.
67. Add evidence language to scenario pages without exposing raw private run data.
68. Add public growth dashboard links to discovery pages.
69. Add devlog links for freshness.
70. Add canonical handling for query-driven play pages.
71. Add canonical handling for scenario detail routes.
72. Add canonical handling for replay routes as noindex.
73. Add canonical handling for local UI lab routes as noindex.
74. Add a growth preflight that reports readiness as pass, warn, or fail.
75. Add clear failure output for missing metadata.
76. Add clear failure output for local or placeholder production URLs.
77. Add clear failure output for missing deployable artifacts.
78. Add public JSON artifacts that future CI can upload or inspect.
79. Keep generated artifacts deterministic aside from generation timestamps.
80. Avoid hand-maintained sitemap entries.
81. Avoid hand-maintained social preview metadata.
82. Avoid hand-maintained scenario discovery pages.
83. Avoid indexing pages that require wallet state or encoded user data.
84. Avoid keyword stuffing.
85. Avoid exposing raw simulator internals as public marketing copy.
86. Prefer specific scenario claims over generic game claims.
87. Prefer useful canonical pages over duplicate query URLs.
88. Prefer evidence-backed public pages over empty promotional pages.
89. Make discovery pages usable even when generated reports are missing.
90. Make generation work in local development and production.
91. Make generation fail loudly in strict mode when deploy-critical checks fail.
92. Make non-critical improvement opportunities warnings, not blockers.
93. Integrate the SEO pipeline with the existing growth scripts.
94. Integrate the SEO pipeline with the existing verification mindset.
95. Preserve negative space and readability on new public pages.
96. Keep all components responsive and overflow-safe.
97. Keep all page copy intentionally designed and concise.
98. Run focused SEO tests.
99. Run artifact generation.
100. Run strict SEO doctor.
101. Run app build after routing/head changes.
102. Check git status.
103. Commit the complete implementation.
104. Confirm the repo is clean.

## Done Criteria

The implementation is complete when public routes have generated metadata, crawlable artifacts are written, route pages exist for scenarios and discovery topics, private routes are protected from indexing, the runtime SPA head updates on navigation, tests pass, `growth:seo` passes, and the repository is committed cleanly.
