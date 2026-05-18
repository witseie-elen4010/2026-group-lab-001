# Sprint 4 Retrospective

**Date of Meeting:** 2026-05-25  
**Sprint Duration:** 1 week  
**Team Members:** AnEnigmaticSock, KheliD12345, BierVoetje  
**Sprint Goal:** Deliver final enhancement features, to simplify login, improve both student and lecturer convenience, including UI polish and degree programme autofill, and expand the database to include real entities for real-world use.

---

## 1. Sprint Summary

| Metric | Value |
|---|---|
| Sprint number | 4 |
| Sprint duration | 1 week |
| Team size | 3 members |
| User stories planned | 6 |
| Other planned items | 1 |
| Additional stories added mid-sprint | 1 |
| Total items delivered | 9 |
| User stories delivered | 6 |
| Other items delivered | 2 |
| Epics closed | 1 |

---

## 2. Sprint Velocity

### Stories Delivered

| Title | Label | Estimate (days) |
|---|---|---|
| Register/Sign-in with Google | enhancement, user-story | 4 |
| Wits Lecturers & Schools | enhancement, user-story | 2 |
| Daily Summary | enhancement, user-story | 2 |
| UI Polish | enhancement, user-story | 4 |
| Follow Lecturers | enhancement, user-story | 2 |
| Register University | enhancement, user-story | 4 |
| Advanced Password Protection | enhancement, security | — |
| missing Logs | bug | — |
| Fix Cancellation | bug | — |

> Enhancement is an epic and is excluded from velocity. Advanced Password Protection was not delivered and did not have an estimate. Fix Cancellation and missing Logs were delivered without estimates and are also excluded.

**Sprint 4 Velocity: 18 person-days**

This sprint closed the Enhancements epic by delivering login simplification, UI polish, interactive features, and an expanded database ready for real-world use.

---

## 3. What Went Well

- Most planned sprint 4 stories were delivered and the planned epic was closed by end of sprint.
- The web app was successfully registered to use Google Sign-In via the Google Cloud Console, allowing for modernised login that is convenient to the user.
- UI Polish allowed for a colour-blind friendly look, and dynamic sizing/spacing for mobile optimisation.
- Seeder script was succesfully implemented to seed the Wits website for all lecturers in the CLM, EBE and Science faculty, allowing updates of the database when new staff has been hired.
- Lecturer-facing management was further improved through the Daily Summary view.
- Student experience was successfully improved via following lecturers, which added a quick view of upcoming consultations on their home view, and peers.
- The team absorbed the additional Fix Cancellation and missing Logs stories within the sprint and kept delivery on track.
- A full course catalogue, a template preview API endpoint, and persistent academic profile storage were implemented in the Register University story.

---

## 4. What Went Wrong

- Custom buttons for the UI Polish story could not be implemented, due to unforeseen complications arising with their implementation.
- The seeder script could not include Humanities faculty and some Health Sciences schools, due to the unsupported formatting of the staff lists that could not be interpreted by the seeder.
- Dynamic button sizing and lecturer search bar pagination in the UI Polish story brought about problems that had to be resolved, delaying the ability to create a PR for merging.
- Advanced Password Protection could not be implemented, due to time constraint.

---

## 5. What Can Be Improved

- Advanced Password Protection can be implemented.
- Custom buttons can be implemented.
- Automated seeding for new lecturer profiles can be implemented to remove the requirement of manually seeding the Wits website.
- Implement functionality for users to change/recover their password, via email verification.
- Implement account deletion request page.


---

## 6. Final Thoughts

Sprint 4 closed the Enhancements epic and brought the application closest to a real-world deployment: users can now sign in with Google, students can follow lecturers and explore Wits academic programmes via autofill, and the database is seeded with real faculty data. The team delivered all planned stories and absorbed two unplanned bugs without missing scope — a strong finish. Remaining gaps (Advanced Password Protection, account recovery, custom UI components) are well-defined and implementable without architectural changes. Overall, the project progressed steadily across four sprints from a skeleton login system to a functioning consultation platform.