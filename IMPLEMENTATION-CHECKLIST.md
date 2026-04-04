# Implementation Checklist

## Phase 0: Repository Bootstrap

- [x] Initialize the repository.
- [x] Create the TypeScript workspace layout.
- [x] Add root tooling and workspace manifests.
- [x] Add `README.md`, `IMPLEMENTATION-CHECKLIST.md`, and `AGENTS.md`.
- [x] Add `.env.example`, source config examples, and verification scripts.
- [x] Install workspace dependencies.

## Phase 1: Interview And Inputs

- [ ] Confirm the exact source roster for v1.
- [x] Confirm target Sonos room(s) and playback behavior.
- [x] Confirm the morning briefing schedule.
- [x] Confirm the briefing opens with Lantzville, BC weather.
- [x] Confirm desired voice personas and pronunciation exceptions.
- [x] Collect `XAI_API_KEY`, `EXA_API_KEY`, and `ELEVENLABS_API_KEY`.
- [x] Defer Playwright-based X and Reddit scraping from the default rollout.
- [ ] Decide whether Chrome remote debugging will be used or only a dedicated automation session.

## Phase 2: Verification Gate

- [x] Run `pnpm verify:tools`.
- [x] Run `pnpm verify:services` with real `.env` values.
- [x] Confirm Playwright can launch a browser.
- [x] Confirm `agent-browser` can access the dedicated automation session path.
- [x] Confirm local audio tooling can write output artifacts.
- [x] Confirm Sonos target information is present.
- [x] Stop and ask questions if any verification item fails.

## Phase 3: TDD Slice Order

- [x] Slice 1: config loading and runtime validation.
- [x] Slice 2: admin/config API and persistence.
- [x] Extend the `/sources` admin UI so source definitions, topic lists, Exa filters, and weights are editable.
- [x] Slice 3: public-source ingestion and artifact capture.
- [x] Slice 4: X-search ingestion through xAI.
- [x] Slice 5: clustering and dedupe.
- [x] Slice 6: ranking and explainable feed.
- [x] Slice 7: end-to-end discovery/enrichment orchestration for active public/X sources.
- [ ] Slice 8: browser-auth source ingestion after explicit opt-in and later manual testing.
- [x] Slice 9: podcast story selection and spoken script generation.
- [x] Slice 10: ElevenLabs audio generation and stitching.
- [x] Slice 11: Sonos playback orchestration and restore behavior.
- [ ] Slice 12: end-to-end scheduled run.

- [x] Add CLI debug mode for transcript preview.
- [x] Add production-script output with voice-role and delivery cues for the briefing CLI.
- [x] Clear live ElevenLabs synthesis access for CLI MP3 generation.
- [x] Add a dedicated ElevenLabs probe command for voice-lookup and dialogue-access debugging.
- [x] Add a local audio-host CLI command for serving generated briefing artifacts.
- [x] Add Sonos probe and play CLI commands around the local network control path.
- [x] Clear live Sonos discovery through the Node client or capture a stable direct speaker host.
- [x] Add a one-shot `briefing:deliver` command for external schedulers or manual runs.
- [x] Add a one-shot `briefing:generate` command that runs ingest plus MP3 generation without Sonos playback.
- [x] Add a one-shot `ingest:run` command for live source discovery, Exa-first enrichment, artifact capture, and feed-snapshot refresh.
- [x] Persist normalized stories and clusters as first-class MongoDB collections during ingest runs.
- [x] Persist generated podcast runs in MongoDB and expose them through a `/podcasts` archive page.

## Quality Gates

- [ ] Each feature starts with a failing automated test.
- [ ] Every external boundary has runtime validation.
- [ ] No secrets are checked into source control.
- [ ] No workaround code lands for missing access or missing tooling.
- [ ] Every major run path emits operational logs and artifacts.
- [x] Replace file-backed state with MongoDB-backed persistence for source registry, feed snapshot, discovery artifacts, ingest runs, stories, and clusters.
