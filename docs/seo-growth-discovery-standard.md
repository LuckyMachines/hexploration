# SEO, Growth, And Discovery Standard

Xenovoya discovery must be automated, crawl-safe, and evidence-aware.

## Public Indexing Rules

- Public pages must have a stable canonical URL, title, description, Open Graph metadata, Twitter metadata, and JSON-LD when relevant.
- Query URLs should canonicalize to stable route pages when they represent the same durable content.
- Wallet-specific, encoded replay, local debug, and internal tooling routes must be marked `noindex`.
- The sitemap must be generated from the public route registry, never maintained by hand.
- Robots and `llms.txt` must point crawlers and assistant-style tools toward the most useful public surfaces.

## Content Rules

- Scenario pages must be generated from the same scenario data that powers play and growth systems.
- Public copy must describe what a player can do, what feeling the scenario targets, and why the route is worth opening.
- Discovery pages should group real scenarios by player intent, not generic keywords.
- Reports can be summarized publicly, but raw private run data and local-only state should not be exposed.
- Metadata must be specific enough to make a share preview readable without opening the site.

## Validation Rules

- Titles should be present, unique enough, and stay within preview-friendly length.
- Descriptions should be present, useful, and stay within preview-friendly length.
- Canonical URLs must be absolute and use the configured public site URL.
- Public routes must not use localhost, private IPs, or placeholder domains in strict checks.
- Every generated artifact must include a generation timestamp and schema version.
- Strict SEO checks should fail deployment preflight only for issues that would damage indexing, sharing, or crawl safety.

## Automation Rules

- `npm run seo:generate` writes crawlable artifacts.
- `npm run seo:test` validates metadata helper behavior.
- `npm run seo:doctor` validates the generated public discovery surface.
- `npm run growth:seo` is the one-command growth/discovery preflight.
- Generated public artifacts are deployable; generated reports under `reports/seo` are local evidence.
