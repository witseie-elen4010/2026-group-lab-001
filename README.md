<div align="center">

# Let's Talk

### A consultation scheduling platform for students and lecturers at Wits University

[![Coverage Status](https://coveralls.io/repos/github/witseie-elen4010/2026-group-lab-001/badge.svg?branch=main)](https://coveralls.io/github/witseie-elen4010/2026-group-lab-001?branch=main)
[![CI](https://github.com/witseie-elen4010/2026-group-lab-001/actions/workflows/ci.yml/badge.svg)](https://github.com/witseie-elen4010/2026-group-lab-001/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/badge/Node.js-20-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/atlas)
[![Jest](https://img.shields.io/badge/Jest-30-C21325?logo=jest&logoColor=white)](https://jestjs.io/)

[Live App](https://letstalk-d7ve.onrender.com) · [Report a Bug](https://github.com/witseie-elen4010/2026-group-lab-001/issues) · [Request a Feature](https://github.com/witseie-elen4010/2026-group-lab-001/issues)

</div>

---

## About The Project

Let's Talk is a web application that connects students and lecturers at the University of the Witwatersrand by streamlining the scheduling of group consultations. Lecturers can publish their weekly availability and consultation constraints; students can browse lecturer profiles and initiate consultation bookings.

The application is built with a server-rendered Node.js and Express stack, backed by MongoDB Atlas, and follows a sprint-based delivery model with continuous integration enforced on every pull request.

### Built With

| Layer | Technology |
|---|---|
| Runtime | Node.js 20 |
| Web Framework | Express 5 |
| Templating | EJS |
| Database | MongoDB Atlas (native driver) |
| Sessions | express-session |
| Authentication | Passport.js (Google OAuth 2.0) |
| Testing | Jest 30, Playwright |
| Linting | StandardJS |
| CI | GitHub Actions |
| Coverage Reporting | Coveralls |
| Hosting | Render |

### Sprints
1. [x] **Completed**

2. [x] **Completed**

3. [x] **Completed**

4. [x] **Completed**

---

## Live Deployment

The application is hosted on Render and accessible at:

**[https://letstalk-d7ve.onrender.com](https://letstalk-d7ve.onrender.com)**

---

## Getting Started

### Prerequisites

- Node.js 20 or later
- npm
- A MongoDB Atlas connection string (for database features and Atlas integration tests)

### Installation

1. Clone the repository:
   ```sh
   git clone https://github.com/witseie-elen4010/2026-group-lab-001.git
   cd 2026-group-lab-001
   ```

2. Install dependencies:
   ```sh
   npm install
   ```

3. Create a `.env` file in the project root and add your environment variables:
   ```env
   MONGODB_URI=your_mongodb_atlas_connection_string
   SESSION_SECRET=your_session_secret
   GOOGLE_CLIENT_ID=your_client_id
   GOOGLE_CLIENT_SECRET=your_client_secret
   ```

4. Start the development server:
   ```sh
   npm start
   ```

The app will be available at `http://localhost:8080`.

---

## Database Seeding

The seed script populates the database with real Wits University faculties, schools, and lecturer accounts scraped from [wits.ac.za](https://www.wits.ac.za). It is safe to run more than once — existing lecturer records are never duplicated or modified.

### Prerequisites

- `MONGODB_URI` must be set in your `.env` file (see [Installation](#installation))
- An active internet connection (the script fetches live data from the Wits website)

### Running the seed script

```sh
node scripts/seed_wits_data.js
```

### What it creates

| Collection | Records added |
|---|---|
| `University` | University of the Witwatersrand |
| `Faculty` | Commerce Law & Management, Engineering & the Built Environment, Health Sciences, Science |
| `School` | All schools within the seeded faculties |
| `User` | One lecturer account per scraped staff member |

Each lecturer account is created with the fields `firstName`, `lastName`, `username`, `email`, `passwordHash`, `role`, `universityId`, `facultyId`, and `schoolId`. The default password for each account is the initials portion of the username (e.g. username `CDKatWits` → password `CDK`). If multiple lecturers share the same initials, a counter suffix is appended to both: the second becomes username `CDKatWits2` → password `CDK2`, the third `CDKatWits3` → password `CDK3`, and so on.

> **Note:** The Humanities faculty and certain dispersed Health Sciences schools (Clinical Medicine, Oral Health Sciences, Pathology) are excluded from seeding as their staff pages are not structured for automated scraping.

> **Re-runs:** If all lecturers scraped from a school already exist in the database, the script will report `0 lecturers seeded` for that school. This is expected behaviour — no duplicates are created.

---

## Features

### Authentication & Accounts

- **User registration** — Students and lecturers can register with their name, email address, username, password, and role
- **Google OAuth sign-in** — Users can sign in with a Google account; new Google users complete a one-time registration step to set their role and institutional details
- **User login** — Session-based authentication with secure password hashing
- **Role-based redirection** — Students and lecturers are directed to their respective home pages on login
- **Authentication guard** — All private routes require an active session; unauthenticated requests are redirected to login

### Student Experience

- **Student home page** — Central navigation hub with quick access to browse lecturers and manage consultations
- **Browse lecturers** — Search for lecturers by name with real-time typeahead results and paginated output; matches full names in either order (first–last or last–first)
- **Follow lecturers** — Students can follow a lecturer to scope their consultation search to that lecturer's sessions
- **View lecturer profiles** — Students can view a lecturer's institutional details, consultation preferences, and weekly availability
- **Schedule consultation** — Students can check a lecturer's availability for a given date and time before creating a booking
- **Create consultation** — Students can create a new group consultation with a lecturer at an available date and time slot
- **Join consultation** — Students can browse open consultations (filterable by lecturer, date, and time) and join them; when no consultations exist for an available slot a direct link to create one is shown
- **Academic profile** — Students can save their degree programme and a list of enrolled courses; the system suggests courses from Wits degree templates when a known degree is selected

### Lecturer Experience

- **Lecturer home page** — Displays a monthly calendar with each day colour-coded to reflect the lecturer's availability: green for available days, red for exception dates
- **Consultation preferences** — Lecturers can set the minimum and maximum number of students per session, the duration per consultation (in minutes), and the daily maximum number of consultations
- **Weekly availability** — Lecturers can specify their available days of the week with start and end times for each day
- **Unavailable dates** — Lecturers can list specific dates on which they are unavailable, overriding their usual weekly pattern
- **AJAX form submission** — Consultation and availability settings update without a full page reload, with inline success and error feedback
- **Lecturer dashboard** — Calendar-based view of all upcoming booked consultations, grouped by date with attendee rosters
- **Cancel consultation** — Lecturers can cancel any upcoming consultation from the dashboard
- **Daily summary** — Lecturers can view all of today's consultations grouped by time slot

### User Profile

- **Profile page** — Displays username, name, email address, role, and institutional affiliation
- **Institution update** — Users can update their university, faculty, and school via a typeahead search backed by the Atlas institution database
- **Lecturer preferences display** — Students viewing a lecturer's profile see their consultation preferences and availability in a read-only layout

### Institution Search

- **University, faculty, and school search** — Typeahead API endpoints return matching institutions filtered by partial name, with parent-scoped filtering (faculty results scoped to a selected university; school results scoped to a selected faculty)

### Admin

- **Audit log viewer** — Admin users can access a paginated log of all significant user actions (logins, consultation creates/joins/cancellations, profile updates, and more), persisted to the database by the action logger middleware

---

## Running Tests

Run the full test suite (unit, integration, E2E, and Atlas system tests) with combined coverage:

```sh
npm test
```

Atlas integration tests require `MONGODB_URI` to be set. When the variable is absent, those tests are automatically skipped and the suite still passes.

Run individual tiers:

```sh
npm run test:unit              # Jest unit tests only
npm run test:integration:web   # Web integration tests (mocked routes)
npm run test:e2e               # Playwright end-to-end tests
```

Run the StandardJS linter:

```sh
npm run lint
```

### Test Coverage

Tests are organised into four tiers:

| Tier | Location | Description |
|---|---|---|
| Unit | `tests/unit/` | Pure function tests — validation logic, calendar utilities, middleware |
| Integration | `tests/integration/` | Route handlers with mocked MongoDB; real HTTP server and session handling |
| E2E | `tests/E2E/` | Browser-driven acceptance tests via Playwright against a live server |
| System / Acceptance | `tests/models/atlas.test.js` | Live Atlas connection — verifies seeded data and relationship lookups |

---

## Continuous Integration

Every pull request and push to `main` triggers the GitHub Actions CI pipeline, which:

1. Runs StandardJS across all source and test files
2. Executes the full Jest suite with `--runInBand`
3. Publishes the coverage report to [Coveralls](https://coveralls.io/github/witseie-elen4010/2026-group-lab-001) for tracking coverage trends across builds

The `MONGODB_URI` secret is injected from GitHub repository secrets; if it is absent the Atlas tests skip automatically so the build remains green.

---

## Architecture

Key architectural decisions are documented in [`documentation/architecture/`](https://github.com/witseie-elen4010/2026-group-lab-001/tree/main/documentation):

| ADR | Decision |
|---|---|
| [ADR 001](https://github.com/witseie-elen4010/2026-group-lab-001/tree/main/documentation/architecture/001_adr.md) | Express.js as the HTTP framework |
| [ADR 002](https://github.com/witseie-elen4010/2026-group-lab-001/tree/main/documentation/architecture/002_adr.md) | MongoDB Atlas with the official Node.js driver |
| [ADR 003](https://github.com/witseie-elen4010/2026-group-lab-001/tree/main/documentation/architecture/003_adr.md) | Jest for automated testing with GitHub Actions CI |
| [ADR 004](https://github.com/witseie-elen4010/2026-group-lab-001/tree/main/documentation/architecture/004_adr.md) | Coveralls for code coverage reporting with GitHub Actions CI |
| [ADR 005](https://github.com/witseie-elen4010/2026-group-lab-001/tree/main/documentation/architecture/005_adr.md) | Render for hosting |
| [ADR 006](https://github.com/witseie-elen4010/2026-group-lab-001/blob/main/documentation/architecture/006_adr.md) | Built-in scrypt for Password Hashing |
| [ADR 007](https://github.com/witseie-elen4010/2026-group-lab-001/blob/main/documentation/architecture/007_adr.md) | Google OAuth 2.0 Sign-In |

---

## Team

| Name | GitHub |
|---|---|
| Khelan Desai | [@KheliD12345](https://github.com/KheliD12345) |
| Jessica Johnson | [@AnEnigmaticSock](https://github.com/AnEnigmaticSock) |
| Wynand van Heerden | [@BierVoetjie](https://github.com/BierVoetjie) |
