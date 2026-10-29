# Contributing

Thanks for taking an interest in RunLattice. The project is still evolving, so small and well-scoped changes are easiest to review.

## Local setup

1. Follow the [Getting started](README.md#getting-started) guide.
2. Create a feature branch from `main`.
3. Keep secrets in `.env`; never commit credentials or production data.
4. Run `npm run typecheck`, `npm run test` and `npm run build` before opening a pull request.

## Code guidelines

- Prefer clear names and small functions over clever abstractions.
- Validate request data at the API boundary.
- Keep demo/sample data clearly identified as such.
- Do not evaluate arbitrary workflow text as code.
- Add tests when changing validation, queue behaviour or state transitions.
- Explain any new environment variable in `.env.example` and the README.
