# Sprint 1 Retrospective

**Date of Meeting:** 2026-05-04  
**Sprint Duration:** 1 week  
**Team Members:** AnEnigmaticSock, KheliD12345, BierVoetje  
**Sprint Goal:** Deliver the foundational authentication, lecturer configuration, and student discovery epics, along with core navigation and role distinction.

---

## 1. Sprint Summary

| Metric | Value |
|---|---|
| Sprint number | 1 |
| Sprint duration | 1 week |
| Team size | 3 members |
| User stories planned | 6 |
| Developer-sized stories planned | 3 |
| Additional stories added mid-sprint | 3 |
| Total items delivered | 15 |
| User stories delivered | 6 |
| Developer-sized stories delivered | 6 |
| Epics closed | 3 |

---

## 2. Sprint Velocity

### Stories Delivered

| Title | Label | Estimate (days) |
|---|---|---|
| User Registration and Login | user-story | 2 |
| Role Distinction | user-story | 2 |
| Navigation | user-story | 3 |
| Lecturer Availability Settings | user-story | 2 |
| Lecturer Consultation Settings | user-story | 2 |
| Browse Lecturers | user-story | 4 |
| User Table | developer-sized-story | 1 |
| University Table | developer-sized-story | 1 |
| Lecturer Availability Table | developer-sized-story | 1 |
| Refactor code to fit conventions | developer-sized-story | 1 |
| Automated test build upon merge/main | developer-sized-story | 1 |
| Deployment | developer-sized-story | — |

> Epics (Authentication, Lecturer Configuration, Student Discovery) are containers and are excluded from velocity. Deployment was delivered without an estimate and is also excluded.

**Sprint 1 Velocity: 20 person-days**

This establishes our baseline velocity. Sprint 2 planning will use 20 days as the reference for capacity.

---

## 3. What Went Well

- All 6 planned user stories and all developer-sized stories were delivered and merged by end of sprint.
- Three additional stories were added and completed mid-sprint, demonstrating spare capacity.
- Pull requests were reviewed promptly and the GitHub board was kept up to date.
- Contributions were balanced across all three team members.
- CI was configured to run automated tests on every merge to main.
- The application was successfully deployed to Render.

---

## 4. What Went Wrong

- Test suites were not implemented for every pull request.
- Story dependencies created bottlenecks that limited parallel development.

---

## 5. What Can Be Improved

- Implement comprehensive test suites for every pull request.
- Finish critical user stories as soon as possible to avert bottlenecks.

---

## 6. Sprint 2 Goals

- Implement core consultation creation and booking functionality (student-facing).
- Implement the lecturer dashboard with upcoming consultation views.
- Begin enforcement of scheduling constraints (capacity, overlap prevention).
- Increase unit test coverage for all new controllers and services.
- Begin writing end-to-end tests, targeting full E2E automation by the final sprint.
- Maintain or exceed Sprint 1 velocity of 20 person-days.
