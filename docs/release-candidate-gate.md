# Release Candidate Gate

The candidate gate separates local release reproducibility from live post-deploy health.

## Before deployment

From a reviewed commit on `main`, set `XENOVOYA_EXPECTED_RELEASE_SHA` to the full candidate commit and run:

```powershell
npm run verify:hard
npm run release:verify-candidate
```

The candidate passes only when:

- the checkout is clean and on `main`;
- the expected full SHA equals `HEAD`;
- fresh hard-tier evidence passed with no failures, timeouts, or skips;
- that hard evidence was captured from the same clean commit;
- `app/dist/release.json` identifies the same production release;
- the Coolify rollback contract is valid.

Use `npm run release:candidate` for a written diagnostic report. A passing candidate audit authorizes only the deployment decision; it does not deploy anything.

## After deployment

Deploy both reviewed repositories through their configured Coolify Git workflows. Then set `XENOVOYA_EXPECTED_RELEASE_SHA` and `XENOVOYA_EXPECTED_MARKETING_RELEASE_SHA` to their respective full commits and run `npm run release:verify-live`. The strict live audit refuses to run as promotion evidence without both identities. It verifies player route chunks, deep links, both sites' security headers and release metadata, discovery files, Return API readiness, Sepolia connectivity, capability scope, and rollback evidence.

Never treat a dirty workspace, a build from another commit, or a live release without exact-SHA matching as a release candidate.
