# Architecture

This document explains how **MD2Docs** converts raw AI-generated Markdown into Google Docs and Microsoft Word clipboard payloads, and *why* each transformation exists.

---

## 1. End-to-End Conversion Pipeline

Every edit or target switch runs `convertMarkdown(rawMd, target, mathMode)` in [`app.js`](../app.js) through 6 stages:

```text
Raw Markdown
  │
  ▼
[1] preprocessMarkdown()
    • Normalizes CRLF/CR to LF
    • Extracts footnote definitions ([^id]: ...) outside fenced code
    • Single-pass scanner skips fenced code & inline code spans
    • Extracts math ($$...$$, \[...\], \(...\), $...$) → XMDMATH{BLK|INL}{id}X
    • Converts ==mark== → <mark> and [^id] → <sup>[N]</sup>
  │
  ▼
[2] marked.parse() + DOMPurify.sanitize()
    • Parses GFM (tables, task lists, strikethrough, autolinks, fences)
    • Sanitizes HTML while permitting safe formatting tags & data:image/* URIs
  │
  ▼
[3] Target DOM Transformers (detached <div>, using PROFILES[target])
    • transformCodeBlocks()       → shaded bordered table + inline HLJS colors + &nbsp;/<br>
    • transformBlockquotes()      → accent-bordered table + GitHub Alert detection
    • transformDataTables()       → explicit cell borders, alignment, header & zebra shading
    • transformTypographyAndMedia() → inline styles for H1-H6, p, lists, Unicode checkboxes,
                                      inline code spans, links, hr, mark, kbd, SVG→PNG images
  │
  ▼
[4] Parallel Cached Math Rendering (renderMathExpression)
    • 'png'     → MathJax.tex2svg() (fontCache: 'none') → Canvas (3× DPI) → PNG data URI
    • 'mathml'  → MathJax.tex2mml() → clean W3C MathML (data-mjx-* stripped)
    • 'unicode' → texToUnicodeHtml() (Greek, operators, fractions, <sup>/<sub>)
    • 'latex'   → Raw $...$ / $$...$$ in monospace
    • Injects results back into placeholders (avoiding nested <p><p> for display math)
  │
  ▼
[5] buildClipboardHtml()
    • gdocs → Clean inline-styled wrapper <div>
    • word  → Full Office-namespaced HTML document (xmlns:o, xmlns:w, xmlns:m, StartFragment)
  │
  ▼
[6] Preview & Export
    • Renders bodyHtml into #preview-paper and clipboardHtml into #html-source
    • Copy via Clipboard API (text/html + text/plain) with contenteditable execCommand fallback
    • Word mode also supports downloading a .doc file (BOM + Office HTML)
```

---

## 2. Why Specific Compatibility Tricks Exist

Both Google Docs and Microsoft Word parse `text/html` clipboard payloads with strict, idiosyncratic subsets of HTML/CSS.

### Google Docs Clipboard Quirks

| Element | What Google Docs Strips / Breaks | How MD2Docs Solves It |
| :--- | :--- | :--- |
| Stylesheets & classes | Ignores `<style>` blocks and `class="..."` | Every element receives explicit inline `style="..."` |
| `<pre><code>` blocks | Drops background color, borders, and often collapses leading spaces | Wraps code in a bordered shaded `<table>`, maps Highlight.js tokens to inline `color:` styles, and preserves leading/consecutive spaces with `&nbsp;` and newlines with `<br>` |
| `<blockquote>` | Drops `border-left` and background shading | Wraps quotes and GitHub Alerts (`[!NOTE]`, `[!TIP]`, etc.) in a single-cell `<table>` with `border-left: 3pt solid ...` and tinted background |
| MathML (`<math>`) & `<svg>` | Drops `<svg>` entirely; turns `<math>` into garbled unformatted text | Renders LaTeX via `MathJax.tex2svg` (`fontCache: 'none'`) onto an offscreen `<canvas>` at 3× scale and embeds a transparent `data:image/png;base64,...` `<img>` with exact baseline `vertical-align` |
| `<input type="checkbox">` | Drops form inputs completely | Replaces task list checkboxes with colored Unicode `☑` and `☐` spans |
| Inline SVG `<img>` | Strips `data:image/svg+xml` images | Automatically rasterizes SVG data URIs to 2× PNG data URIs |

### Microsoft Word Clipboard Quirks

| Element | Word Behavior | How MD2Docs Solves It |
| :--- | :--- | :--- |
| Equations | Desktop Word natively imports W3C MathML (`<math xmlns="http://www.w3.org/1998/Math/MathML">`) as editable Office Math (OMML) equations | Defaults Word target to `mathMode = 'mathml'` via `MathJax.tex2mml()`, stripping MathJax's `data-mjx-*` and `class` attributes; offers PNG fallback for Word Online |
| Document structure | Honors `xmlns:o`, `xmlns:w`, `xmlns:m`, `<!--StartFragment-->`, `mso-outline-level`, `mso-border-alt`, and `mso-highlight` | `buildClipboardHtml(..., 'word')` wraps output in a full Office-namespaced HTML document and transformers emit `mso-*` attributes |
| Offline / file sharing | Users sometimes want a file rather than clipboard paste | `.doc` button downloads UTF-8 BOM + Office HTML (`application/msword`), which opens directly in Word with headings, tables, code boxes, and native equations |

---

## 3. Caching & Responsiveness

- **Debounced input**: Typing in `#markdown-input` debounces conversion by `140ms`; target/math toggles and toolbar actions render immediately.
- **Race-condition safety**: `state.renderVersion` increments on every `runRender()` call; stale async renders discard their results before touching the DOM.
- **Memoization**:
  - `mathPngCache` caches rendered PNG equations by `(display, tex)`.
  - `mathMmlCache` caches MathML strings by `(display, tex)`.
  - `svgRasterCache` caches rasterized SVG data URIs.
- **Persistence**: Last input is stored in `localStorage` under `mdtodocs_last_markdown_v1` (bypassed when `?sample=1` is present).

---

## 4. External CDN Dependencies

All third-party libraries are pinned to exact versions in [`index.html`](../index.html) via jsDelivr:

| Library | Version | Purpose |
| :--- | :--- | :--- |
| `marked` | `12.0.2` | GFM Markdown &rarr; HTML parsing |
| `dompurify` | `3.1.6` | HTML sanitization |
| `@highlightjs/cdn-assets` | `11.10.0` | Syntax highlighting for fenced code blocks |
| `mathjax` (`es5/tex-svg.js`) | `3.2.2` | Programmatic `tex2svg` (for PNG) and `tex2mml` (for Word MathML) |

Graceful degradation: if a CDN script fails to load (e.g., offline use), `app.js` falls back cleanly — plain code escaping if `hljs` is absent, and Unicode math formatting if `MathJax` is unavailable.
