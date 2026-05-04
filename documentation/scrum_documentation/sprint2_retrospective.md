# Sprint 2 Retrospective

**Date of Meeting:** 2026-05-11  
**Sprint Duration:** 1 week  
**Team Members:** AnEnigmaticSock, KheliD12345, BierVoetje  
**Sprint Goal:** Deliver the core consultation creation and booking flow, enforce scheduling constraints, improve consultation discovery, and strengthen automated test coverage.

---

## 1. Sprint Summary

| Metric | Value |
|---|---|
| Sprint number | 2 |
| Sprint duration | 1 week |
| Team size | 3 members |
| User stories planned | 6 |
| Developer-sized stories planned | 1 |
| Additional stories added mid-sprint | 1 |
| Total items delivered | 8 |
| User stories delivered | 6 |
| Developer-sized stories delivered | 2 |
| Epics closed | 1 |

---

## 2. Sprint Velocity

### Stories Delivered

| Title | Label | Estimate (days) |
|---|---|---|
| Create Consultation | user-story | 4 |
| Overlap Prevention | user-story | 2 |
| Join Consultation | user-story | 4 |
| Lecturer Config Enforcement | user-story | 2 |
| Consultation Filter | user-story | 4 |
| Student Dashboard | user-story | 2 |
| Improve test coverage | developer-sized-story | 1 |
| Add E2E testing framework | developer-sized-story | — |

> Add E2E testing framework was delivered without an estimate and is excluded from velocity.

**Sprint 2 Velocity: 19 person-days**

This sprint delivered the planned consultation workflow while also adding Coveralls coverage reporting and the first Playwright E2E framework. Sprint 3 planning will use 19 days as the reference.

---

## 3. What Went Well

- All 6 planned user stories and the planned developer-sized story were delivered and merged by end of sprint.
- One additional developer-sized story was added and completed, bringing end-to-end browser testing into the project.
- The full student consultation flow was delivered end-to-end: students can create, search, filter and join consultations.
- Scheduling safeguards were improved through overlap prevention and lecturer configuration enforcement.
- Coveralls coverage reporting was integrated into CI, giving the team persistent visibility into coverage trends across builds.
- Contributions remained balanced across the team, and the scrum board stayed up to date throughout the sprint.

---

## 4. What Went Wrong

- A heavy workload from other courses limited the ambition of the work deliverable in this sprint.
- Some stories depended on lecturer configuration and availability work, which again limited parallel development.
- Testing and delivery-enablement work was harder to estimate than user-facing stories.

---

## 5. What Can Be Improved

- Estimate testing and CI infrastructure work explicitly before it is brought into sprint scope.
- Start end-to-end automation earlier in the sprint so major flows ship with browser coverage immediately.
- Break dependency-heavy stories into smaller increments to reduce bottlenecks between team members.

---

## 6. Sprint 3 Goals

- Expand lecturer and student dashboard functionality around upcoming and scheduled consultations.
- Strengthen the consultation lifecycle with additional management and feedback features after creation and joining.
- Extend Playwright end-to-end coverage across the main authenticated user journeys.
- Increase Coveralls coverage by adding more unit and integration tests for routes, services, and models.
- Continue polishing consultation discovery and scheduling validation to reduce edge-case failures.
- Maintain or exceed Sprint 2 velocity of 19 person-days.
