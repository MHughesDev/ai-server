# Validate Change

Validation sequence for queue-driven work:

1. Run repo validation appropriate to the change.
2. Run `npm run queue:audit`.
3. Confirm queue files were not mutated by executors.
