# News Aggregator

Local-first personal news aggregation system with a ranked web feed, admin/config control plane, and a scheduled morning audio briefing for Sonos.

## Current Status

This repository now includes:

1. The TypeScript workspace and package boundaries.
2. Verified local tool and service access.
3. Runtime config validation and source registry validation.
4. Writable source registry persistence with a minimal web control surface at `/sources`.
5. Public-source fetch planning and raw artifact capture primitives in the worker.
6. xAI X-search request planning and execution primitives in the worker.
7. Shared story normalization, URL cleanup, and first-pass clustering/dedupe logic.
8. Baseline ranking, a feed preview UI/API, and worker feed snapshot materialization.
9. Morning briefing script generation with voice-role hints and ElevenLabs dialogue-plan output.
10. Local audio artifact hosting plus live-validated Sonos probe/playback CLI commands.
11. A one-shot delivery command that generates the MP3 and pushes it to Sonos.

Scheduled run orchestration is intentionally still pending.

## Product Goals

- Aggregate stories from personal and public sources.
- Produce a priority-ordered, Twitter-like feed in a web UI.
- Provide an admin/config UI for sources, API keys, ranking controls, and operational tasks.
- Generate a morning podcast from the top confirmed stories.
- Open the morning podcast with the day weather for Lantzville, BC.
- Play the briefing on Sonos at a scheduled time.
- Run through Codex-compatible skills backed by deterministic TypeScript helpers.

## Architecture Direction

### Runtime Model

- Single user.
- Local-first.
- Intended for a trusted home network.
- Browser-authenticated sources use a dedicated automation profile.
- External provider secrets live in `.env`.
- Public article-body extraction should prefer Exa before any browser fetch.
- Sonos playback can use room-name discovery or an explicit speaker host override.

### Workspace Layout

- `apps/web`: Next.js feed UI and configuration interface.
- `apps/worker`: scheduled jobs, ingestion orchestration, ranking, podcast assembly, playback.
- `packages/core`: shared schemas, typed models, config contracts, scoring inputs.
- `packages/skills`: Codex-compatible skill scaffolding and helper script entrypoints.
- `packages/test-utils`: shared fixtures for TDD slices.
- `config/`: checked-in example source definitions.
- `data/`: local operational state such as SQLite.
- `artifacts/`: fetched raw content, transcripts, audio, and run logs.
- `scripts/`: repo-level verification and bootstrap scripts.

## Workflow Rules

### Hard Stop Rule

If a required tool, provider token, browser automation session, or Sonos capability is missing, stop execution and ask a question. Do not invent a workaround, substitute a provider, or silently skip the missing dependency.

### Credentials

- Tokens go in `.env`, never in checked-in JSON or TypeScript files.
- Checked-in config files may describe sources and defaults, but not secrets.
- Browser auth state belongs under `playwright/.auth/` and must remain untracked.

### TDD

After the scaffold, interview, and verification steps are complete, all feature work proceeds test-first:

1. Write the failing test.
2. Implement the minimum code to pass.
3. Refactor without broadening scope.
4. Repeat one vertical slice at a time.

## Morning Briefing Format

- Start with Lantzville, BC weather.
- Include at minimum the day high temperature, rain or precipitation expectation, and a plain-language condition summary.
- Follow weather with the ranked top stories and supporting context.

## Source Rollout

- X starts in API mode only through xAI-backed topic searches. Browser automation is not part of the default rollout.
- Reddit personalized home-feed scraping is modeled in config, but it is disabled by default and marked manual opt-in until later testing.
- Public sources such as Hacker News, RSS feeds, and direct article URLs should rely on Exa-first extraction instead of browser automation whenever authentication is not required.

## Getting Started

### Prerequisites

- Node `22.19.0+`
- `pnpm` `10.33.0+`
- `codex`
- `agent-browser`
- `playwright`
- `ffmpeg`

### Bootstrap

```bash
cp .env.example .env
pnpm install
pnpm verify:tools
pnpm verify:services
```

`pnpm verify:services` is expected to fail until real credentials and runtime details are provided.

### Development Commands

```bash
pnpm dev
pnpm dev:web
pnpm dev:worker
pnpm lint
pnpm test
pnpm test:e2e
```

### Worker Debug Commands

```bash
pnpm --filter @news-aggregator/worker briefing:preview
pnpm --filter @news-aggregator/worker briefing:audio
pnpm --filter @news-aggregator/worker briefing:deliver
pnpm --filter @news-aggregator/worker elevenlabs:probe
pnpm --filter @news-aggregator/worker audio:serve
pnpm --filter @news-aggregator/worker sonos:probe
pnpm --filter @news-aggregator/worker sonos:play-briefing
```

- `briefing:preview` prints the current morning briefing transcript using the ranked feed snapshot plus live Lantzville weather.
- The preview output is a production script: each block includes the reader role, intended voice profile, and inline delivery cues such as `[calm]` and `[short pause]`.
- `briefing:audio` prints that same script, writes `artifacts/briefings/<date>/morning-briefing.dialogue.json`, and then attempts to synthesize `artifacts/briefings/<date>/morning-briefing.mp3` through the ElevenLabs Text to Dialogue API.
- `briefing:deliver` generates the latest morning briefing MP3 and immediately instructs Sonos to play it using the hosted audio URL from `AUDIO_HOST_BASE_URL`.
- `elevenlabs:probe` runs a minimal voice lookup plus a tiny two-speaker dialogue generation, then writes `artifacts/briefings/<date>/elevenlabs-probe.json` and, on success, `artifacts/briefings/<date>/elevenlabs-probe.mp3`.
- `audio:serve` hosts the `artifacts/` tree over HTTP for Sonos to fetch, using the port from `AUDIO_HOST_BASE_URL` and binding on `0.0.0.0`.
- `sonos:probe` tries live local-network discovery, reports discovered room names, and identifies the configured target room.
- `sonos:play-briefing` maps the generated MP3 into a hosted URL and instructs the target Sonos room to play it.
- At the moment, the preview and audio commands work end-to-end with the current ElevenLabs key. The probe command is there to isolate future auth or product-access issues without running the full briefing flow.
- The Sonos path is now validated live. Discovery found `Bedroom Ceiling`, and direct-host playback also worked when `SONOS_TARGET_HOST=10.3.78.223` was supplied for the run.

### Current Web Surface

- `/`: control-plane landing page
- `/feed`: ranked feed preview
- `/sources`: source rollout and enablement controls
- `/api/feed`: current feed snapshot read endpoint
- `/api/sources`: current source registry read/update endpoint

## Security Caveat

The initial product direction assumes home-network use without app-level authentication. That is convenient for a personal setup, but it raises the risk profile because the UI will eventually control API keys, authenticated browser sessions, and Sonos playback. If the exposure model changes, authentication and transport security need to move up in priority immediately.

## Planned Next Steps

1. Wire real worker ingestion runs to persist `data/feed-snapshot.json`.
2. Add podcast story selection over ranked feed clusters.
3. Keep browser-auth collectors deferred until later manual testing.
