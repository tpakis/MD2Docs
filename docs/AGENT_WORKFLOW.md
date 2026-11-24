# Agent Workflow Guide

Practical playbook for AI coding agents (Antigravity, Claude Code, Codex, Cursor, Gemini CLI, etc.) contributing to **MD2Docs**.

---

## 1. Before Editing

1. Read [`AGENTS.md`](../AGENTS.md) and [`docs/ARCHITECTURE.md`](ARCHITECTURE.md).
2. Check current repo status and recent history:
   ```bash
   git status
   git log --oneline -n 10
   ```
3. Remember: **no build step, no `type="module"`, no external bundler**. Everything must work both when served over HTTP and when opened directly via `file:///.../index.html`.

---

## 2. Common Task Recipes

### A. Adding Support for a New Markdown Construct

Determine where in the pipeline the construct belongs:

1. **Syntax not in standard GFM** (e.g., custom admonitions, definition lists, Mermaid blocks, new math delimiters):
   - Handle it inside `preprocessMarkdown()` in [`app.js`](../app.js) **inside the single-pass scanner**, after the fenced code block (`A`) and inline code (`B`) branches so code blocks are never corrupted.
   - If you introduce custom HTML tags or `data-*` attributes, whitelist them in `DOMPurify.sanitize(...)` (`ADD_TAGS` / `ADD_ATTR`).
2. **Standard HTML emitted by `marked` that needs target-specific styling**:
   - Add inline styling inside `transformTypographyAndMedia()` (or a dedicated transformer) using values from `PROFILES[target]`.
   - Avoid CSS classes on exported document nodes — both Google Docs and Microsoft Word expect inline `style="..."`.
   - If the element needs a layout table (like code blocks or callouts), mark it with `data-layout-table="..."` before `transformDataTables()` runs so it isn't restyled as a data table.

### B. Updating Google Docs or Microsoft Word Styling

- Edit `PROFILES.gdocs` or `PROFILES.word` at the top of [`app.js`](../app.js).
- Keep font sizes in `pt` (`11pt`, `9.5pt`, `20pt`, etc.) rather than `px` — both Google Docs and Microsoft Word map `pt` directly to native document font sizes.
- Test any structural change (especially tables, code blocks, and math) by pasting the copied output into real Google Docs and Microsoft Word whenever possible, or inspecting the **HTML** tab (`?view=html`).

### C. Modifying Math Rendering

- **PNG mode (`renderMathToPng`)**:
  - Keep `svg: { fontCache: 'none' }` in `index.html`.
  - Keep `currentColor` replaced with an explicit hex ink color (`#1f1f1f`) before serializing SVG to a data URI.
  - Keep `encodeURIComponent(svgStr)` rather than `btoa(svgStr)` so non-ASCII characters inside `\text{...}` don't throw `InvalidCharacterError`.
- **MathML mode (`renderMathToMathML`)**:
  - Keep `data-mjx-*` and `class` attributes stripped so Word's MathML &rarr; OMML importer stays clean.
- **Unicode mode (`texToUnicodeHtml`)**:
  - Always escape HTML special characters (`&`, `<`, `>`) before injecting `<sup>` / `<sub>` tags to avoid broken markup on `<` / `>` inequalities.

### D. Adding a New Export Target (e.g., Notion, Confluence, Slack)

1. Add a profile entry to `PROFILES` and a default math mode to `DEFAULT_MATH_MODE` in [`app.js`](../app.js).
2. Add a button to `.target-selector` in [`index.html`](../index.html) with `data-target="<id>"`.
3. Update `applyUrlParams()`, `buildClipboardHtml()`, and `updateTargetUI()` in [`app.js`](../app.js).
4. Add accent variables in [`styles.css`](../styles.css) (following the `body.mode-word` pattern).

---

## 3. Testing & Verification

### Quick CLI Verification

Always run a syntax check on `app.js`:

```bash
node --check app.js
```

Verify all `document.getElementById(...)` calls in `app.js` match IDs in `index.html`, and test pure functions (`preprocessMarkdown`, `texToUnicodeHtml`, `preserveCodeWhitespace`, `buildClipboardHtml`) on edge cases:
- Currency values (`$50–$100`, `$10-$20`) must stay plain text.
- Code blocks and inline code containing `$HOME`, `$$`, `\(...\)`, or `\[...\]` must never be parsed as math.
- All 4 math delimiters (`$...$`, `$$...$$`, `\(...\)`, `\[...\]`) must resolve cleanly with zero `XMDMATH` tokens remaining in rendered output.

### Local Server & Visual Verification

Start a local static server from the repository root:

```bash
python3 -m http.server 8765 --bind 127.0.0.1
```

Open and verify these URLs:
- `http://127.0.0.1:8765/?target=gdocs&sample=1` — Google Docs mode (PNG equations, tables, code block, diagram, checklist, footnote)
- `http://127.0.0.1:8765/?target=word&sample=1` — Microsoft Word mode (MathML equations, Word headings, `.doc` button)
- `http://127.0.0.1:8765/?target=word&sample=1&view=html` — HTML source inspector (Office XML namespaces + inline styles)

Stop the temporary server when finished.

---

## 4. Updating README Screenshots

Whenever you make visible UI or styling changes, refresh the 2× Retina screenshots in `docs/screenshots/` using headless Chrome against the local server (`http://127.0.0.1:8765`):

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu --user-data-dir=/tmp/mdtodocs-chrome \
  --window-size=1440,960 --force-device-scale-factor=2 --virtual-time-budget=10000 \
  --screenshot=docs/screenshots/google-docs-mode.png \
  "http://127.0.0.1:8765/?target=gdocs&sample=1"

"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu --user-data-dir=/tmp/mdtodocs-chrome \
  --window-size=1440,960 --force-device-scale-factor=2 --virtual-time-budget=10000 \
  --screenshot=docs/screenshots/microsoft-word-mode.png \
  "http://127.0.0.1:8765/?target=word&sample=1"

"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu --user-data-dir=/tmp/mdtodocs-chrome \
  --window-size=1440,960 --force-device-scale-factor=2 --virtual-time-budget=10000 \
  --screenshot=docs/screenshots/html-inspector.png \
  "http://127.0.0.1:8765/?target=word&sample=1&view=html"
```

Always visually inspect the generated PNGs before committing and remove `/tmp/mdtodocs-chrome` afterward.

---

## 5. Git Hygiene

- Keep commits focused and descriptive (e.g., `Add URL query params for target and math mode`, `Fix Google Docs table border styling`).
- Never commit temporary files, local test scripts, or `/tmp` artifacts.
- Keep `README.md`, `AGENTS.md`, and `docs/` in sync whenever behavior, shortcuts, query parameters, or supported Markdown features change.
