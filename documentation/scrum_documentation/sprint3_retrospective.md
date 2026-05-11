# Sprint 3 Retrospective

**Date of Meeting:** 2026-05-18  
**Sprint Duration:** 1 week  
**Team Members:** AnEnigmaticSock, KheliD12345, BierVoetje  
**Sprint Goal:** Deliver consultation cancellation and activity logging, expand lecturer-side consultation management, and strengthen the supporting automated tests.

---

## 1. Sprint Summary

| Metric | Value |
|---|---|
| Sprint number | 3 |
| Sprint duration | 1 week |
| Team size | 3 members |
| User stories planned | 5 |
| Other planned items | 1 |
| Additional stories added mid-sprint | 1 |
| Total items delivered | 9 |
| User stories delivered | 5 |
| Other items delivered | 2 |
| Epics closed | 2 |

---

## 2. Sprint Velocity

### Stories Delivered

| Title | Label | Estimate (days) |
|---|---|---|
| Student cancel | enhancement, user-story | 3 |
| Lecturer cancel | enhancement, user-story | 3 |
| Capture Actions | enhancement, security | 4 |
| View Logs | user-story | 2 |
| Lecturer Dashboard | user-story | 3 |
| Lecturer Roster | enhancement, user-story | 3 |
| Fix tests | bug | — |

> Cancellation and Activity Log are epics and are excluded from velocity. Fix tests was delivered without an estimate and is also excluded.

**Sprint 3 Velocity: 18 person-days**

This sprint closed the Cancellation and Activity Log epics while delivering cancellation flows, action logging, lecturer-side consultation management and a late test-fix story. Sprint 4 planning will use 18 days as the reference.

---

## 3. What Went Well

- All planned sprint 3 stories were delivered and both planned epics were closed by end of sprint.
- The consultation lifecycle was extended successfully with both student and lecturer cancellation flows.
- Lecturer-facing management improved through the dashboard and roster work, while auditability improved through action capture and log viewing.
- The team absorbed the additional Fix tests story within the sprint and kept delivery on track.

---

## 4. What Went Wrong

- The only substantial difficulty was a change around deletion of database records, which required the tests to be rewired late in the sprint.

---

## 5. What Can Be Improved

- Isolate database-deletion behavior behind clearer test helpers so storage changes do not ripple through multiple test suites.
- Validate destructive data flows earlier in the sprint so related test fixes happen before final integration.

---

## 6. Sprint 4 Goals

- Harden deletion and cancellation flows with stronger unit and integration coverage.
- Extend Playwright coverage across cancellation, dashboard, roster, and logs journeys.
- Continue improving lecturer and student management of scheduled consultations.
- Refine activity logging so key consultation actions remain easy to audit.
- Reduce test maintenance overhead by consolidating shared fixtures and database setup logic.
- Maintain or exceed Sprint 3 velocity of 18 person-days.