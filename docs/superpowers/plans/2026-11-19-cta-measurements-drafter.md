# CTA Measurements Drafter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One offline HTML file that merges current + prior CTA aortic measurements with priors in parentheses.

**Architecture:** `cta-drafter.html` is the deliverable and the source. Pure logic lives in `<script id="core">` (no DOM), exposing `globalThis.CTACore`. UI lives in a second script. Node tests extract the core script with a regex and run it in `vm`.

**Tech Stack:** Vanilla HTML/CSS/JS, Node `node:test` for tests, Playwright (preinstalled) for a smoke screenshot.

**Spec:** `docs/superpowers/specs/2026-11-19-cta-measurements-drafter-design.md`

## Global Constraints

- No external resources (no CDN, fonts, network). Works from `file://`.
- Yale Blue `#00356B` the only accent; manual light/dark toggle only.
- Red flag at ≥ 3 mm change on any dimension.
- PIN 147258 stored hashed only.

## Review Focus

- Windows line endings (`\r\n`) pasted from PowerScribe/Epic must parse identically.
- Decimals (`4.6 cm`, `29.5`) must parse; cm → red flag.
- Prior pasted with surrounding report text (Impression, etc.) — non-measurement lines ignored.
- Labels in different case / extra spaces / missing colon space (`Mid ascending aorta:26`).
- Empty prior or empty current must not throw; output empty or passthrough.

---

### Task 1: Core parser + matcher (`CTACore.parseLine`, `CTACore.matchLandmark`)
- Test: `tests/core.test.js` — label normalization drops `(graft)`; every synonym in the spec table maps to its key; Review Focus inputs parse.
- [ ] failing tests → implement → pass → commit

### Task 2: Merge (`CTACore.merge({current, prior, priorStudy}) -> {text, lines:[{text,status,reason}], unused:[label], summary:{red,amber}}`)
- Test: built-in examples Pair 1, C, D, A produce the spec's expected output exactly; flags (3 mm, cm, duplicate, no prior, left as dictated); header rewrite with prior study.
- [ ] failing tests → implement → pass → commit

### Task 3: Numbers-only (`CTACore.buildFromNumbers(numbers, prior) -> {text, error|null}`)
- Test: tokens incl. `39x37x44`, `-` skip, empty prior uses 10-line template + header, count mismatch error.
- [ ] failing tests → implement → pass → commit

### Task 4: UI — tabs, inputs, live output with dots, Copy/Reset, theme toggle, admin (PIN hash, examples with pass/fail, synonym table)
- Verify: Playwright smoke script loads file://, fills Pair D, asserts output text, unlocks admin with PIN, asserts all examples pass; screenshots light + dark.
- [ ] implement → smoke → commit → push
