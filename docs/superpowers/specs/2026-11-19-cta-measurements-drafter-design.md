# CTA Measurements Drafter — Design

Date: 2026-11-19
Status: draft, awaiting approval

## Intent

Radiologists reading CTA aorta studies dictate a block of aortic diameters and
then dictate the prior study's value in parentheses after each one ("open paren,
26, close paren..."). That is slow and tedious. This tool takes the current block
(as dictated) and the prior block (as copied from the prior report) and produces
the merged block with priors in parentheses, ready to paste into the report.

Users: radiologists at YNHH. It lives as one HTML file on a common shared drive and
is opened in the browser (Edge/Chrome on Windows) straight from that drive.

## Goals

- Paste current + prior, get merged output instantly, copy with one click.
- Match levels reliably even when labels differ between studies (graft/mechanical
  notes, a different prior template, missing or extra lines).
- Flag anything that needs a human look; never silently insert a wrong prior.
- "Numbers only" entry: type just the current numbers and the tool builds the
  current block from the prior's labels.
- Several cases open at once in page tabs.
- Admin mode (PIN) to review built-in examples and check the tool's output on them.
- Minimal, Mac-like look in Yale Blue.

## Non-goals

- Feedback collection (explicitly dropped).
- Other templates (abdomen-only, runoff, iliacs). Only the thoracic/abdominal aorta
  list below.
- Writing the impression or interval-change sentences.
- Converting units.

## Anti-goals (failure even if it "works")

- A prior number attached to the wrong level without a flag.
- Any network request, or report text leaving the machine.
- Anything that needs IT to install (extension, macro, server, packages).

## Constraints

- One self-contained `.html` file: all CSS/JS inline, no CDN, no web fonts, no
  network. Must work opened via `file://` from a shared drive.
- Browser storage is per computer/per browser; that is acceptable (used only for
  keeping open tabs across a refresh).
- Clipboard: use `navigator.clipboard.writeText`, fall back to
  `document.execCommand('copy')` if unavailable.

## Approaches considered

1. **Landmark dictionary with synonyms + fallback (chosen).** Each line on both
   sides is mapped to one of ten known landmarks via known names and synonyms;
   current and prior are paired by landmark. Unknown labels fall back to word
   overlap and are flagged. Predictable; correctly drops a prior line whose level
   was deleted from the current block (e.g., Sinus of Valsalva removed). Chosen.
2. **Pure word-similarity matching.** No list to maintain, but long, overlapping
   labels cause wrong pairings — e.g., with Sinus deleted from the current block, a
   prior "Aortic root at the sinus" could attach to Sinotubular junction. Rejected.
3. **AI/online parsing** (needs network, sends text off-machine) and **PowerScribe
   macro / browser extension** (needs IT install). Ruled out.

## Landmarks and synonyms

Matching runs on a normalized label: lowercase, parenthetical notes removed
("(graft)", "(mechanical)"), punctuation and "mm" removed, whitespace collapsed.
Check the most specific names first.

| Key | Canonical label | Also matches |
|---|---|---|
| sinus | Sinus of Valsalva | aortic root at the sinus, aortic root, sinus |
| stj | Sinotubular junction | stj |
| midAsc | Mid ascending aorta | ascending aorta (only if no other ascending label matched) |
| proxBrachio | Ascending proximal to the brachiocephalic | distal ascending aorta |
| arch | Top of the aortic arch proximal to left subclavian | aortic arch, arch |
| proxDesc | Proximal descending distal to left subclavian | proximal descending thoracic aorta |
| midDesc | Mid descending thoracic aorta | — |
| diaphragm | Aorta at the diaphragm | distal descending thoracic aorta at the hiatus, at the hiatus |
| suprarenal | Suprarenal aorta | — |
| infrarenal | Infrarenal aorta | — |

The user confirmed the mappings for the alternate prior template (example A).
The list lives in one table in the code so a new synonym is a one-line change.

## Parsing a line

`<label>: <value><rest>`

- **Value:** a number (decimals allowed) or `N x N` / `N x N x N`, optional
  `mm` / `cm`. Spacing around `x` is tolerated (`28 x 28 x 28`, `28x28x28`).
- **Existing parenthetical** right after the value, with or without a space
  (`27(27)`, `28 x 28 x 28(29 x 25)`, `(45 on 04/20/2011)`).
- **Rest:** any trailing text (`, unchanged compared with February 17, 2025`).
- **Text-only value** ("Status post aortic valve replacement.") means a line with no
  measurement.
- **Header line:** a line containing "cross-sectional diameters" (not a landmark).
- Blank lines and anything else are passed through unchanged.

**Prior value used** = the prior line's value with its own parenthetical and units
removed, all dimensions kept (`46 x 45 mm` → `46 x 45`). The user wants as much
data kept as possible.

## Building the output

Follow the **current** block line by line, keeping its labels, order, spacing and
wording.

- Measured line with a matched prior: insert ` (<prior>)` immediately after the
  value, e.g., `Mid ascending aorta (graft): 29 (30)`.
- No matching prior line: leave the line as is; amber "no prior".
- Prior line whose landmark is not in the current block (e.g., Sinus deleted):
  dropped; listed as a muted "not used" note under the output.
- Current line that already has a parenthetical (A: `48 (45 on 04/20/2011)`) or
  trailing free text (B): left exactly as dictated; amber "left as dictated".
  *(Builder's call — see "Calls to check".)*
- Text-only current line: passed through, no status.
- Header: if the optional "Prior study" field is filled (e.g., `CTA 08/16/2024`),
  rewrite the header's parenthetical to
  `(prior values from CTA 08/16/2024 in parentheses)`. Otherwise leave the header
  as dictated. No header is added if the current block has none.

## Flags

Per line, shown as a colored dot next to the output line with a short reason on hover:

- **Green:** matched to a known landmark, prior parsed, change < 5 mm.
- **Amber:** no prior found; matched only by fallback word overlap; left as
  dictated.
- **Red:** any dimension differs by ≥ 5 mm (could be real growth or a typo such as
  3 vs 30); `cm` on either side; two prior lines mapping to the same landmark; two
  current lines mapping to the same landmark; a number that can't be read.

Overall status above the output: a green check "All lines matched" when there are
no red flags (amber count shown as a quiet note, e.g., "2 without prior"); otherwise
red "N items need review".

## Numbers-only entry

A single input, e.g., `30 30 36 31 29 24 22` or `39x37x44, 40, 50, …`.

- Tokens separated by spaces or commas; `NxNxN` is one token; `-` skips (deletes)
  that line.
- Labels come from the prior block's landmark lines, in the prior's order, keeping
  label notes like "(graft)" and dropping the prior's own parentheticals. The
  prior's header comes along too.
- If the prior is empty, the standard 10-line template (table above, canonical
  labels) plus the standard header is used.
- The result is written into the **Current** box (so it can still be edited), and the
  normal merge produces the output.
- Token count ≠ line count: red flag stating expected vs. got.

## Page layout

```
CTA Measurements Drafter                                   [Admin]
[ Case 1 × ] [ Case 2 × ] [ + ]
--------------------------------------------------------------------
Numbers only: [ 30 30 36 31 29 24 22          ]   Prior study: [        ]
[ Current (dictated)      ]   [ Prior (pasted)          ]
--------------------------------------------------------------------
● All lines matched · 2 without prior                  [Reset] [Copy]
Output (live)
  ...
Not used from prior: Sinus of Valsalva
```

- **Tabs:** each tab holds its own current, prior, prior study and numbers fields.
  `+` adds "Case N"; double-click renames; × closes. Tabs are saved in this
  browser's storage so a refresh doesn't lose them.
- **Reset:** clears the active tab's fields.
- **Copy:** copies the output text; the button briefly reads "Copied".

## Admin mode

- "Admin" opens a PIN prompt. The PIN (147258) is stored as a hash in the file,
  not as plain text. This is a light gate, not real security.
- Once unlocked (for this page session), the page shows the built-in examples
  (below): current, prior, expected output (if known), the tool's actual output,
  and pass/fail. A "Load into new tab" button opens any example as a case.
- Also shows the landmark/synonym table as read-only reference.

## Built-in examples / test cases

From the user's samples (de-identified):

- **Pair 1:** current = the "(graft)" block without parentheticals; prior = the
  "Status post aortic valve replacement" block. Expected = the user's first block.
  Note: prior's Sinus line is text-only, and the current block has no Sinus line.
- **Pair C:** expected = C's first block; prior = C's second block.
- **Pair D:** expected = D's first block (supra/infrarenal with no prior, amber);
  prior = D's second block (no space before `(`).
- **Pair A:** current = A's first block; prior = A's second (alternate template).
  Expected: Sinus `39 x 42 x 40 (39 x 38 x 36)`, STJ `42 (40 x 38)`,
  Mid ascending left as dictated (already has prior), proxBrachio `40 (42 x 41)`,
  arch `35 (33 x 30)`, proxDesc `34 (33 x 32)`, midDesc `29 (28 x 27)`,
  diaphragm `28 (25 x 25)`.
- **B, E, F, G:** single blocks used as current-only / numbers-only tests and as
  templates (B: trailing free text; E/F: supra/infrarenal; G: dated header).

Automated tests run the merge on every pair and compare against the expected output.
The builder chooses how (e.g., a Node script that loads the inline logic, or
Playwright on the HTML).

## Look

- Minimal, Mac-like: lots of white space, rounded 12–16px panels, soft shadows,
  subtle frosted header, thin dividers, restrained motion.
- Color: Yale Blue `#00356B` as the only accent (buttons, active tab, focus rings,
  links); a lighter tint for hovers/backgrounds. Status dots use green/amber/red only
  for meaning.
- Fonts: `-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`;
  monospace for text boxes and output (`ui-monospace, "SF Mono", Consolas, monospace`).
- Light theme by default; follows the system dark setting.

## Calls to check (decided by Claude, not the user)

1. Insert ` (prior)` with a single space, keeping the current line's own spacing.
2. Lines with an existing parenthetical or trailing free text are left untouched
   (amber), not merged.
3. Red threshold for change is ≥ 5 mm on any dimension.
4. Prior lines whose level is missing in the current block are dropped silently
   except for the muted "not used" note.
5. Tabs persist in this browser's storage; Reset clears only the active tab.
6. Dark mode follows the system setting.

## Left to the builder

File structure inside the HTML, the hash function for the PIN, exact styling
values, and the test harness.
