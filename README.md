# CTA Measurements Drafter

A single offline HTML page that merges current CTA aorta measurements with the prior study's values in parentheses.

**To use:** copy `cta-drafter.html` to the shared drive and open it in Edge or Chrome. It needs no internet connection and no installation, and nothing leaves the browser.

- **Current:** dictated measurements. **Prior:** paste the prior block (or the whole prior report).
- **Numbers only:** type just the current numbers (`39x37x44 40 50 …`, `-` skips a line). It fills Current using the prior's labels, or the standard 10-line template if no prior is pasted.
- **Prior study** (optional): rewrites the header to `(prior values from <study> in parentheses)`.
- Dots: green = matched, amber = no prior / left as dictated, red = ≥3 mm change or a problem (cm units, duplicate level).
- Tabs hold separate cases and are remembered in that computer's browser. Reset clears the current tab.
- **Admin** (PIN) shows the built-in examples with pass/fail, plus the landmark names that are recognized.

## Development

All logic is in `<script id="core">` inside the HTML (no DOM), and the UI is in `<script id="app">`.

```
node --test tests/core.test.js   # logic tests against the built-in examples
node tests/smoke.js [shotDir]    # browser test via Playwright (file://)
```

To add a recognized name for a level, edit `RULES` (matching) and `LANDMARKS[].also` (admin display) in the core script.
Design: `docs/superpowers/specs/2026-11-19-cta-measurements-drafter-design.md`.
