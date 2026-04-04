# Project Instructions

These instructions apply to the entire repository.

## Core Rules

- Use TypeScript for application and tooling code.
- Do not introduce Python or any non-JavaScript runtime language.
- Keep the architecture local-first and single-user unless the user explicitly changes scope.
- Treat missing tools, missing credentials, or missing service access as hard blockers. Stop and ask instead of building around them.
- Store provider secrets only in `.env` or a future approved local secret store. Never commit secrets.
- Keep browser automation state outside source control under `playwright/.auth/`.

## Delivery Order

1. Scaffold and governance docs.
2. Interview for specifics and collect credentials.
3. Verify tool and service access.
4. Begin TDD-driven feature slices.

Do not skip ahead to feature implementation if the verification gate has not passed.

## Code Organization

- Put feed, admin UI, and API routes in `apps/web`.
- Put scheduled jobs, ingestion, ranking, podcast, and playback orchestration in `apps/worker`.
- Put shared schemas, types, and validation in `packages/core`.
- Put Codex skill scaffolding and helper entrypoints in `packages/skills`.
- Put test fixtures and helpers in `packages/test-utils`.

## Testing

- After the verification gate, all feature work must begin with a failing test.
- Prefer small vertical slices with focused assertions.
- Validate every external boundary at runtime even when TypeScript types exist.

## Operational Notes

- Keep checked-in source config separate from secrets.
- Preserve raw artifacts needed for debugging provider and scraping failures.
- Do not assume remote/cloud deployment requirements unless the user asks for them.
