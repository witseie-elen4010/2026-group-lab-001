## E2E testing vs integration tests vs unit tests

Prior to the addition of playwright and an E2E framework, unit tests included tests for every single file under src (excluding views and public/main.css). Unit tests therefore became overly verbose and difficult to understand. 

Now with playwright and an e2e framework in-place, unit tests should cover resusable logic (i.e. standalone functions that do not require setting up an environment, simulating a web server/API endpoints or importing other files)

Integration tests should cover interactions between components (e.g.between search.js and university_db.js)

End to end tests (e2e) should be used sparingly (<10% total tests) and are meant to test the logic flow between many modules and components as would be experienced by the user. 

When to add each:

-unit tests: when adding or editing internal code logic
- integration tests: when editing/adding routes/controllers, linking functionality together (like schedule consultations page with the consultation db logic)
- E2E: New/edited pages and routes.