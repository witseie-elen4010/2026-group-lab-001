# Coding Style Guide

## 1. General Principles
- ⁠Write *clean, readable, consistent* code.
- ⁠Prioritise *clarity and simplicity over cleverness*.
- ⁠Code must be *self-documenting* (good names, minimal comments explaining why, not what).

## 2. File and Folder Structure
- ⁠*snake_case* for filenames (e.g., ⁠ login_screen.js ⁠, ⁠ calendar_screen.js ⁠).

## 3. Naming Conventions
- ⁠*Variables:* ⁠ camelCase
```javascript
// Example
let bookedConsultations = 0
```
- *Functions:* camelCase
```javascript
// Example
const getAvailableSeats = function () {
    //Function code
}
```
- *Classes, constructors:* PascalCase
```javascript
// Example
class StudentConsultation {
  constructor (studentName, time) {
    this.studentName = studentName
    this.time = time
  }

  getDetails () {
    return `${this.studentName} has a consultation at ${this.time}`
  }
}

// Example of instantiation
const newConsultation = new StudentConsultation('Jane Doe', '14:00')
```
- ⁠*Constants:* ⁠ UPPER_SNAKE_CASE ⁠
```javascript
// Example
const MAX_CONSULTATIONS = 5
```

## 4. JavaScript Practices
- *Quotes:* Single quotes ⁠ ``'`` ⁠ unless interpolation is needed (then backticks `` ` ``).
- *Function Declaration:* Created using **Anonymous Function Expressions.**
- ⁠Use ⁠``const`` ⁠and ⁠``let``⁠ only (no ⁠``var``⁠).
- ⁠Use template literals for string interpolation.
- ⁠Handle synchronous errors with⁠ `` try-catch ``⁠ blocks, and asynchronous errors with `` promise.catch() ``.

## 5. Express/Node.js Practices
- ⁠Use *async/await* for asynchronous code.
- ⁠Modularise routes and controllers.
- ⁠Use environment variables (⁠ process.env ⁠).
- ⁠Validate all incoming data.

## 6. Comments
- ⁠Comment complex logic and public functions.
- ⁠Use JSDoc style:
```javascript
/**
 * Starts a new calendar view.
 * @param {string} userID - ID of the student/lecturer accessing calendar.
 */
function startCalendarView(userID) { ... }
```

## 7. Linting and Formatting
- Enforce rules and auto-format code exclusively using **standardJS**.
- Use of Prettier prohibited, as its default configuration conflicts with standardJS rules (such as the strict no-semicolon rule). 
- Configured VS Code workspace to format on save using only the standardJS extension.

## 8. HTML Conventions
- Always use **semantic HTML5 elements** (`<header>`, `<nav>`, `<main>`, `<section>`, `<footer>`, etc.).
- Always close all tags (even optional ones like `<li>`, `<td>`, etc.).
- Use **lowercase** for all tag names and attributes.
- Attribute order: `id`, `class`, then others (e.g., `src`, `href`, `alt`, `title`).
- Use **double quotes** for attribute values:
  ```html
  <img src="A08235677_PFP.png" alt="User Profile Pic">
  ```
- Use meaningful `alt` text for images (important for accessibility).
- Forms must have associated labels.

## 9. CSS/Bootstrap Conventions
- Use **snake_case** for class names if writing custom CSS:
  ```css
  .login_screen_header {
    font-size: 2rem;
    text-align: center;
    margin-bottom: 1rem;
  }

  .calendar_base {
    background-color: #e4ca3a;
    border: 1px solid #ffffff;
    border-radius: 0.5rem;
    padding: 1rem;
  }
  ```
- Bootstrap utility classes should be **stacked logically**, not scattered randomly:
  ```html
    <div class="d-flex flex-column align-items-center justify-content-center p-4">
        <h1 class="fs-2 fw-bold">Welcome to Undercover</h1>
    </div>
  ```
- Avoid using **IDs** for styling (use classes).
- Group related CSS classes together for readability.
- Prefer existing **Bootstrap** utility classes when possible instead of writing custom CSS.