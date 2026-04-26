# Code Review Guide

## 1. General Principles
- ⁠Every feature/bugfix must go through a *pull request (PR)*.
- ⁠Direct commits to ⁠``main``⁠ branch used only for *small changes*.

## 2. Pull Request (PR) Process
- ⁠*Clear PR Titles*: Follow Angular commit message format:
```
// Commit message header
<type>(<scope>): <short summary>
  │       │             │
  │       │             └─⫸ Summary in present tense. Not capitalized. No period at the end.
  │       │
  │       └─⫸ Commit Scope: animations|bazel|benchpress|common|compiler|compiler-cli|core|
  │                          elements|forms|http|language-service|localize|platform-browser|
  │                          platform-browser-dynamic|platform-server|router|service-worker|
  │                          upgrade|zone.js|packaging|changelog|docs-infra|migrations|
  │                          devtools
  │
  └─⫸ Commit Type: build|ci|docs|feat|fix|perf|refactor|test

// Example 
fix(router): fix payload parameter in post request // header

// Source: https://medium.com/@carlosalmonte04/angular-commit-messages-541b2ecadde
```
- ⁠*Link PR to Issue*.
- ⁠*Checklist in PR Description*:
  - [ ] Code compiles and runs
  - [ ] Tests written or updated
  - [ ] No commented-out code
  - [ ] standardJS passed
  - [ ] Linked issue number

## 3. PR Creator Responsibilities
- ⁠Test code before submitting by ensuring documented **acceptance tests** are met.
- ⁠Ensure code builds and runs cleanly.
- PR must address a specific developer/user story.
- Provide a good pull request description.
- Must respond to review feedback by making a new commit that addresses the issues prior to merging.

## 4. Reviewer Responsibilities
- **Workload Balance:** Every group member is expected to actively review and merge pull requests during each sprint.
- ⁠Review against:
  - Logic correctness
  - Naming consistency and the StandardJS style guide
  - Basic security (input validation)
  - Acceptance test presence
  - Test coverage (should be atleast 80% via coveralls)
- Reviews must be meaningful and include **substantive direct code comments** explaining any issues.
- ⁠Approve and merge only if code is completely satisfactory and issues are corrected.

## 5. Merging Rules
- ⁠Reviewer merges the PR after approval.
- ⁠Always pull latest ⁠``main``⁠ into your branch before merging if needed.