# Project Instructions

These instructions apply to the entire repository.

## Core Rules

- Use TypeScript for application and tooling code.
- Do not introduce Python or any non-JavaScript runtime language.
- Keep the architecture local-first and single-user unless the user explicitly changes scope.
- Treat missing tools, missing credentials, or missing service access as hard blockers. Stop and ask instead of building around them.
- Store provider secrets only in `.env` or a future approved local secret store. Never commit secrets.
- Keep browser automation state outside source control under `playwright/.auth/`.
- Keep `.omx/`, generated `artifacts/`, local `data/`, and desktop metadata like `.DS_Store` out of commits.
- Do not implement scheduling or automation files unless the user explicitly asks again.

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
- Sonos playback can target either a discovered room name or a direct `SONOS_TARGET_HOST` override.
- `briefing:deliver` assumes the audio file is already reachable at `AUDIO_HOST_BASE_URL`; it does not boot the HTTP host for you.
- `briefing:generate` is the scheduler-safe path for ingest plus MP3 generation without Sonos playback.
- The dashboard (`/`) can trigger podcast generation, and `/podcasts` reads historical `podcast_runs` entries from MongoDB.
- The default public/X news-harvesting path now exists through `ingest:run`. Core operational persistence is MongoDB-backed, including normalized stories, clusters, feed snapshots, article cache, and podcast runs; authenticated browser collectors are still incomplete.
