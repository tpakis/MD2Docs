# AGENTS.md

Instructions and invariants for AI coding agents working on **MD2Docs**.

> For deeper technical details, read [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and [`docs/AGENT_WORKFLOW.md`](docs/AGENT_WORKFLOW.md) before making non-trivial changes.

---

## 1. Project Purpose

**MD2Docs** is a zero-build static web tool that converts Markdown produced by AI agents (tables, math equations, inline code, fenced code blocks, images, callouts, task lists, footnotes) into rich HTML optimized for clipboard paste into **Google Docs** or **Microsoft Word**.

---

## 2. Hard Invariants (Do Not Break)

1. **Zero Build Step & `file://` Compatibility**
   - The app must remain pure static HTML/CSS/JS (`index.html`, `styles.css`, `app.js`).
   - Do **not** introduce a bundler, Node build step, TypeScript compilation step, or ES modules (`<script type="module">`) — ES modules fail over `file://` due to browser CORS restrictions when a user double-clicks `index.html`.
   - Keep `app.js` as a classic IIFE script loaded with `defer`.

2. **All Exported Document Styling Must Be Inline CSS**
   - **Google Docs** strips `<style>` blocks and CSS classes on paste. Every element inside `#preview-paper` / `clipboardHtml` must carry explicit inline `style="..."` attributes.
   - UI chrome styles belong in `styles.css`; exported document styles belong in `PROFILES` and the DOM transformers in `app.js`. Never rely on `styles.css` to style document output.

3. **Clipboard Compatibility Tricks Must Be Preserved**
   - **Code blocks** must render inside a styled `<table>` (not bare `<pre>`), with Highlight.js classes converted to inline `style="color:..."` and indentation preserved via `&nbsp;` + `<br>`. Google Docs strips `<pre>` backgrounds and collapses spaces otherwise.
   - **Blockquotes & GitHub alerts** must render inside a single-cell `<table>` with `border-left` (Google Docs strips `border-left` on `<blockquote>`).
   - **Task list checkboxes** must replace `<input type="checkbox">` with Unicode symbols (`☑` / `☐`), as both Google Docs and Word drop form inputs.
   - **MathJax `fontCache: 'none'`** in `index.html` is mandatory: without it, MathJax SVG output references external `<defs>` in the page DOM and SVG &rarr; Canvas &rarr; PNG rendering produces blank images.
   - **Inline SVG `data:image/svg+xml` images** must be rasterized to PNG data URIs before export (Google Docs drops SVG images on paste).
   - **Microsoft Word clipboard payload** must include Office XML namespaces (`xmlns:o`, `xmlns:w`, `xmlns:m`), `<!--StartFragment-->` / `<!--EndFragment-->`, and clean W3C MathML (with `data-mjx-*` attributes stripped) when `mathMode === 'mathml'`.

4. **Math Extraction Must Protect Code & Currency**
   - `preprocessMarkdown()` in `app.js` uses a single-pass scanner that skips fenced code blocks (`` ``` ``, `~~~`) and inline code spans (`` `...` ``) before matching math (`$$...$$`, `\[...\]`, `\(...\)`, `$...$`).
   - Never replace the single-pass scanner with global regexes that could corrupt `$HOME` in code blocks or currency like `$50–$100`.
   - Placeholder tokens (`XMDMATHBLK{i}X`, `XMDMATHINL{i}X`) must stay strictly alphanumeric (no `_` or `*`) so `marked` never treats them as emphasis, and every placeholder must be resolved before output.

5. **Security & Sanitization**
   - Keep `DOMPurify.sanitize(...)` between `marked.parse(...)` and DOM transformation. Only allow safe URI schemes (`http:`, `https:`, `mailto:`, `tel:`, and safe `data:image/*` types).

6. **Clipboard Fallback**
   - Always keep the `contenteditable` + `document.execCommand('copy')` fallback in `copyFormattedDocument()` so copying still works on `file://` or browsers where `navigator.clipboard.write` is unavailable.

---

## 3. Repository Layout

| Path | Responsibility |
| :--- | :--- |
| `index.html` | Page shell, MathJax v3 config (`fontCache: 'none'`), pinned CDN scripts, semantic controls |
| `styles.css` | Application chrome, theme variables (`--active-accent`, `body.mode-word`), responsive layout |
| `app.js` | Preprocessor, MathJax PNG/MathML/Unicode renderers, inline HLJS highlighter, DOM transformers, clipboard & `.doc` export |
| `docs/ARCHITECTURE.md` | Conversion pipeline design, target profile specs, Docs/Word clipboard quirks |
| `docs/AGENT_WORKFLOW.md` | Recipes for adding features, running automated checks, and updating screenshots |
| `docs/screenshots/` | 2× Retina screenshots referenced in `README.md` |

---

## 4. Verification Checklist Before Committing

Run these checks after every change:

1. **Syntax check**:
   ```bash
   node --check app.js
   ```
2. **DOM ID & pure-function checks**: verify every `document.getElementById(...)` in `app.js` exists in `index.html`, and verify `preprocessMarkdown`, `texToUnicodeHtml`, `preserveCodeWhitespace`, and `buildClipboardHtml` against edge cases (code blocks containing `$`, currency `$50–$100`, all 4 math delimiter styles, footnotes, highlights).
3. **Browser verification** (serve via `python3 -m http.server 8765 --bind 127.0.0.1`):
   - Test **Google Docs** mode (`?target=gdocs&sample=1`): verify PNG equations (`data:image/png`), styled table, syntax-highlighted code box, callout box, rasterized diagram PNG, and zero `XMDMATH` leaks.
   - Test **Microsoft Word** mode (`?target=word&sample=1`): verify MathML `<math>` elements, `.doc` button visibility, and Office XML wrapper in the **HTML** tab (`?target=word&sample=1&view=html`).
   - Confirm zero browser console errors.
4. **Update docs & screenshots** if you changed visible UI or added new Markdown features (see [`docs/AGENT_WORKFLOW.md`](docs/AGENT_WORKFLOW.md)).
