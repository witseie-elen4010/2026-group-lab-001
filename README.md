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
| Testing | Jest 30 |
| Linting | StandardJS |
| CI | GitHub Actions |
| Coverage Reporting | Coveralls |
| Hosting | Render |

### Sprints
1. [x] **Completed**

2. [ ] **Unstarted**

3. [ ] **Unstarted**

4. [ ] **Unstarted**

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
   ```

4. Start the development server:
   ```sh
   npm start
   ```

The app will be available at `http://localhost:8080`.

---

## Features

### Authentication & Accounts

- **User registration** — Students and lecturers can register with their name, email address, username, password, and role
- **User login** — Session-based authentication with secure password hashing
- **Role-based redirection** — Students and lecturers are directed to their respective home pages on login
- **Authentication guard** — All private routes require an active session; unauthenticated requests are redirected to login

### Student Experience

- **Student home page** — Central navigation hub with quick access to browse lecturers and manage consultations
- **Browse lecturers** — Search for lecturers by name with real-time typeahead results and paginated output; matches full names in either order (first–last or last–first)
- **View lecturer profiles** — Students can view a lecturer's institutional details, consultation preferences, and weekly availability

### Lecturer Experience

- **Lecturer home page** — Displays a monthly calendar with each day colour-coded to reflect the lecturer's availability: green for available days, red for exception dates
- **Consultation preferences** — Lecturers can set the minimum and maximum number of students per session, the duration per consultation (in minutes), and the daily maximum number of consultations
- **Weekly availability** — Lecturers can specify their available days of the week with start and end times for each day
- **Unavailable dates** — Lecturers can list specific dates on which they are unavailable, overriding their usual weekly pattern
- **AJAX form submission** — Consultation and availability settings update without a full page reload, with inline success and error feedback

### User Profile

- **Profile page** — Displays username, name, email address, role, and institutional affiliation
- **Institution update** — Users can update their university, faculty, and school via a typeahead search backed by the Atlas institution database
- **Lecturer preferences display** — Students viewing a lecturer's profile see their consultation preferences and availability in a read-only layout

### Institution Search

- **University, faculty, and school search** — Typeahead API endpoints return matching institutions filtered by partial name, with parent-scoped filtering (faculty results scoped to a selected university; school results scoped to a selected faculty)

---

## Running Tests

Run the full Jest test suite (unit, integration, and Atlas system tests):

```sh
npm test
```

Atlas integration tests require `MONGODB_URI` to be set. When the variable is absent, those tests are automatically skipped and the suite still passes.

Run only the database model tests:

```sh
npm run test:db
```

Run the StandardJS linter:

```sh
npm run lint
```

### Test Coverage

Tests are organised into three tiers:

| Tier | Location | Description |
|---|---|---|
| Unit | `tests/services/`, `tests/utils/` | Pure function tests — validation logic, calendar utilities |
| Integration | `tests/routes/`, `tests/models/` | Route handlers with mocked MongoDB; real HTTP server and session handling |
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

---

## Team

| Name | GitHub |
|---|---|
| Khelan Desai | [@KheliD12345](https://github.com/KheliD12345) |
| Jessica Johnson | [@AnEnigmaticSock](https://github.com/AnEnigmaticSock) |
| Wynand van Heerden | [@BierVoetjie](https://github.com/BierVoetjie) |
