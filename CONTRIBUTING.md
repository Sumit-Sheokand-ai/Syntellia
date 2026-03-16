# Contributing to Syntellia
## Development setup
1. Fork and clone the repository.
2. Install dependencies:
   ```bash
   npm ci
   ```
3. Create a `.env` from `.env.example` and set required values.
4. Start services in separate terminals:
   ```bash
   npm run backend:dev
   npm run worker:dev
   npm run dev
   ```
## Required checks before opening a PR
Run all checks locally:
```bash
npm run test
npm run lint
npm run build
```
## Pull request guidelines
- Keep PRs focused and scoped to a single objective.
- Include a clear summary of behavior changes and validation evidence.
- Add or update tests for behavior changes when possible.
- If API behavior changes, update `packages/backend/openapi.json`.
## Commit guidance
- Use descriptive commit messages.
- Avoid force-pushing after review starts unless requested.
## Code standards
- Preserve accessibility and responsive behavior in UI changes.
- Prefer explicit types, input validation, and defensive error handling.
- Keep architecture boundaries intact across `apps/web`, `packages/backend`, and `packages/worker`.
