# MdToDocs

A zero-build static web tool for pasting Markdown produced by any AI agent (ChatGPT, Claude, Gemini, etc.) and copying it cleanly formatted for **Google Docs** or **Microsoft Word**.

## Features

- **Target Selector (Google Docs / Microsoft Word)**:
  - **Google Docs**: Inline CSS styles on every element (Arial typography, Docs-native heading hierarchy, shaded bordered tables, single-cell boxed code blocks with syntax highlighting, callout boxes, Unicode task lists, and 3× Retina PNG equations).
  - **Microsoft Word**: Office-namespaced HTML (`xmlns:o`, `xmlns:w`, `xmlns:m`), Calibri/Consolas styling, Word heading outline levels, table borders (`mso-border-alt`), **native editable MathML equations** (automatically converted by Word into native OMML equations on paste), plus one-click `.doc` file export.
- **Full AI-Agent Markdown Support**:
  - **Math equations**: Supports `$...$`, `$$...$$`, `\(...\)`, and `\[...\]` while ignoring currency values like `$50–$100` and code blocks. Select between **Crisp PNG Image**, **Native Equation (MathML)**, **Editable Unicode Text**, or **Raw LaTeX**.
  - **Tables**: GFM tables with explicit cell borders, column alignment, header shading, and inline math/code inside cells.
  - **Code blocks & inline code**: Syntax highlighting via Highlight.js converted to inline colors, preserved indentation (`&nbsp;`), and shaded bordered containers that survive pasting.
  - **Images**: Supports remote URLs and base64 data URIs; automatically rasterizes inline SVG data URIs to PNG so they paste cleanly into Google Docs and Word.
  - **Rich text**: Headings, bold/italic/strikethrough, `==highlights==`, `<kbd>`, links, nested lists, task lists (`- [x]`), GitHub-style alerts (`> [!NOTE]`, `> [!TIP]`, `> [!IMPORTANT]`, `> [!WARNING]`, `> [!CAUTION]`), horizontal rules, and footnotes.
- **Zero Build Step**: Pure static HTML/CSS/JS — open `index.html` directly in any browser or host on GitHub Pages / Netlify.

## Usage

1. Open `index.html` in your browser (or serve the folder with any static server, e.g. `python3 -m http.server`).
2. Paste your Markdown (or drag and drop a `.md` file) into the left pane.
3. Choose **Google Docs** or **Microsoft Word** in the top bar (and adjust the **Math** format if desired).
4. Click **Copy for Google Docs** / **Copy for Microsoft Word** (or press `Cmd/Ctrl + Shift + C`), then paste into your document with `Cmd/Ctrl + V`.
