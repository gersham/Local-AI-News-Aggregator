---
name: news-orchestrator
description: Orchestrate the personal newsroom pipeline: source runs, ranking refreshes, morning briefing generation, and playback handoff. Use when Codex needs to drive or inspect the end-to-end workflow.
---

# News Orchestrator

## Purpose

This skill is the umbrella coordinator for the personal newsroom system.

## Rules

- Stop immediately if required provider access or local tooling is missing.
- Use deterministic TypeScript helpers from this repository for operational work.
- Do not embed secrets in prompts or checked-in files.
- Keep the feed and morning briefing flows separate unless the task explicitly spans both.

## Planned Responsibilities

- Trigger source ingestion runs.
- Refresh ranked feed materializations.
- Generate the morning briefing transcript and audio assets.
- Trigger local playback handoff after the verification gate is in place.
