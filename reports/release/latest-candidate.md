# Xenovoya Release Candidate Audit

Generated: 2026-09-14T20:17:19.992Z
Status: NOT READY
Grade: B
Candidate: 75c9234c92eec5404ad56872d0a67bd85c46326c
Expected: 75c9234c92eec5404ad56872d0a67bd85c46326c

## Checks

| Check | Result | Detail |
| --- | --- | --- |
| Release branch | PASS | main |
| Clean checkout | FAIL | tracked or untracked changes are present |
| Expected release SHA | PASS | 75c9234c92eec5404ad56872d0a67bd85c46326c |
| Expected SHA matches HEAD | PASS | 75c9234c92eec5404ad56872d0a67bd85c46326c |
| Hard verification evidence | PASS | A evidence from 2026-09-14T15:19:16.169Z |
| Hard evidence provenance | FAIL | hard evidence must come from this commit and a clean checkout |
| Production build identity | PASS | 75c9234c92eec5404ad56872d0a67bd85c46326c |
| Rollback contract | PASS | coolify/xenovoya-player |

## Decision

- Do not deploy. Resolve: candidate.clean, candidate.hard-provenance.

