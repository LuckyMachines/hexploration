# Xenovoya Live Release Audit

Generated: 2026-09-14T20:13:53.147Z
Status: FAIL
Grade: B
Observed release: eeee333cac319d9d2642ac9e00ffed516f12550f
Expected release: not supplied
Observed marketing release: 2a206bfa991ca8b5c5ce7f02a245d42309ca50e6
Expected marketing release: not supplied
Checkout relationship: local-ahead-of-deployed

## Checks

| Check | Required | Result | Detail |
| --- | --- | --- | --- |
| Player homepage | yes | PASS | HTTP 200 |
| Current player bundle | yes | PASS | 1 entry bundle(s), 2 required route chunk(s) |
| Player deep-link fallback | yes | PASS | HTTP 200 |
| Player security headers | yes | PASS | complete header contract |
| Release metadata | yes | PASS | eeee333cac319d9d2642ac9e00ffed516f12550f |
| Expected release match | no | SKIPPED | set XENOVOYA_EXPECTED_RELEASE_SHA during promotion |
| Robots policy | yes | PASS | canonical sitemap declared |
| Sitemap | yes | PASS | home and guest routes declared |
| Marketing homepage | yes | PASS | HTTP 200 |
| Marketing security headers | yes | FAIL | content-security-policy is missing; strict-transport-security is missing; x-frame-options is missing; permissions-policy is missing; cross-origin-opener-policy is missing; cross-origin-resource-policy is missing |
| Marketing release metadata | yes | PASS | 2a206bfa991ca8b5c5ce7f02a245d42309ca50e6 |
| Expected marketing release match | no | SKIPPED | set XENOVOYA_EXPECTED_MARKETING_RELEASE_SHA during promotion |
| Return API readiness | yes | PASS | {"ok":true} |
| Sponsor relay scope | no | SKIPPED | deployed release predates capability metadata; supply XENOVOYA_SPONSOR_RELAY_URL if delegation is enabled |
| Sepolia RPC | yes | PASS | chain 11155111 |
| Rollback contract | yes | PASS | coolify/xenovoya-player |

## Release decision

- Do not promote. Required live gates failed: marketing.security.

## Rollback

- Contract: release/rollback-plan.json
- Fingerprint: d9c8d6c4072192e619a2561e0252e3afdaf16e1a368cd332c926d17fb4044420

