# Implementation Checklist

## Phase 0: Repository Bootstrap

- [x] Initialize the repository.
- [x] Create the TypeScript workspace layout.
- [x] Add root tooling and workspace manifests.
- [x] Add `README.md`, `IMPLEMENTATION-CHECKLIST.md`, and `AGENTS.md`.
- [x] Add `.env.example`, source config examples, and verification scripts.
- [x] Install workspace dependencies.

## Phase 1: Interview And Inputs

- [ ] Finalize the exact v1 source roster and source weights after live feed-quality testing.
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
- [x] Replace in-repo scheduling with one-shot worker commands intended for an external scheduler.

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
- [x] Add a dashboard control to generate podcasts without Sonos playback.
- [x] Add a podcast archive UI with Mongo-backed history and MP3 download links.

## Quality Gates

- [ ] Keep the test-first discipline in place for remaining feature slices.
- [ ] Keep runtime validation at every external boundary as new integrations are added.
- [ ] Keep secrets out of source control.
- [ ] Keep the no-workaround rule in place for missing access or missing tooling.
- [ ] Expand operational logging while preserving the current artifact coverage on major run paths.
- [x] Replace file-backed state with MongoDB-backed persistence for source registry, feed snapshot, discovery artifacts, ingest runs, stories, and clusters.

## Remaining Product Work

- [ ] Improve article-body cleanup so summaries and briefing copy use the first strong factual sentence instead of page chrome.
- [ ] Tighten source-specific relevance gates so regional/topic feeds admit fewer off-target stories.
- [ ] Add operator feedback signals and learned ranking on top of persisted stories and clusters.
- [ ] Decide whether to implement browser-auth collection later through dedicated automation sessions only, or also support Chrome remote debugging.
- [ ] Re-enable and tune additional sources beyond the current Canada-only live test configuration once feed quality is acceptable.
