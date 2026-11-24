(() => {
  'use strict';

  // ============================================================================
  // State & Configuration
  // ============================================================================

  const STORAGE_KEY = 'mdtodocs_last_markdown_v1';

  const DEFAULT_MATH_MODE = {
    gdocs: 'png',
    word: 'mathml'
  };

  const state = {
    target: 'gdocs',        // 'gdocs' | 'word'
    mathMode: 'png',        // 'png' | 'mathml' | 'unicode' | 'latex'
    viewMode: 'rendered',   // 'rendered' | 'html'
    renderedBodyHtml: '',   // Inline-styled body fragment (shown in preview)
    clipboardHtml: '',      // Final HTML written to clipboard for selected target
    plainText: '',          // Fallback text/plain
    renderVersion: 0,
    mathJaxReady: false
  };

  // Caches for fast interactive editing
  const mathPngCache = new Map();
  const mathMmlCache = new Map();
  const svgRasterCache = new Map();

  // DOM References
  const els = {
    input: document.getElementById('markdown-input'),
    previewPaper: document.getElementById('preview-paper'),
    htmlSource: document.getElementById('html-source'),
    targetBtns: document.querySelectorAll('.target-btn'),
    mathModeSelect: document.getElementById('math-mode-select'),
    copyBtn: document.getElementById('copy-btn'),
    copyBtnLabel: document.getElementById('copy-btn-label'),
    downloadDocBtn: document.getElementById('download-doc-btn'),
    pasteBtn: document.getElementById('paste-btn'),
    sampleBtn: document.getElementById('sample-btn'),
    clearBtn: document.getElementById('clear-btn'),
    inputStats: document.getElementById('input-stats'),
    targetBadge: document.getElementById('target-badge'),
    targetHint: document.getElementById('target-hint'),
    statusIndicator: document.getElementById('status-indicator'),
    viewTabs: document.querySelectorAll('.view-tab'),
    dropZone: document.getElementById('drop-zone'),
    toast: document.getElementById('toast')
  };

  // ============================================================================
  // Target Styling Profiles (Inline CSS tuned for Google Docs & Microsoft Word)
  // ============================================================================

  const PROFILES = {
    gdocs: {
      name: 'Google Docs',
      fontFamily: "Arial, Helvetica, sans-serif",
      monoFamily: "'Courier New', Courier, monospace",
      mathSerifFamily: "Georgia, 'Times New Roman', serif",
      fontSize: '11pt',
      lineHeight: '1.5',
      textColor: '#1f1f1f',
      mutedColor: '#5f6368',
      linkColor: '#1155cc',
      headings: {
        1: { size: '20pt', color: '#1f1f1f', weight: '700', marginTop: '18pt', marginBottom: '6pt', borderBottom: 'none' },
        2: { size: '16pt', color: '#1f1f1f', weight: '700', marginTop: '16pt', marginBottom: '5pt', borderBottom: 'none' },
        3: { size: '13.5pt', color: '#1f1f1f', weight: '700', marginTop: '14pt', marginBottom: '4pt', borderBottom: 'none' },
        4: { size: '12pt', color: '#3c4043', weight: '700', marginTop: '12pt', marginBottom: '4pt', borderBottom: 'none' },
        5: { size: '11pt', color: '#5f6368', weight: '700', marginTop: '10pt', marginBottom: '3pt', borderBottom: 'none' },
        6: { size: '11pt', color: '#5f6368', weight: '700', marginTop: '10pt', marginBottom: '3pt', borderBottom: 'none' }
      },
      tableBorder: '#dadce0',
      tableHeaderBg: '#f1f3f4',
      tableHeaderColor: '#1f1f1f',
      tableStripeBg: '#fafafa',
      inlineCodeBg: '#f1f3f4',
      inlineCodeColor: '#c7254e',
      codeBlockBg: '#f8f9fa',
      codeBlockBorder: '#dadce0',
      codeHeaderBg: '#eef1f4',
      codeHeaderColor: '#5f6368',
      quoteBorder: '#9aa0a6',
      quoteBg: '#f8f9fa',
      quoteColor: '#3c4043',
      hrColor: '#dadce0',
      checkColor: '#1a73e8'
    },
    word: {
      name: 'Microsoft Word',
      fontFamily: "Calibri, 'Segoe UI', Arial, sans-serif",
      monoFamily: "Consolas, 'Courier New', monospace",
      mathSerifFamily: "'Cambria Math', Cambria, 'Times New Roman', serif",
      fontSize: '11pt',
      lineHeight: '1.4',
      textColor: '#1f1f1f',
      mutedColor: '#595959',
      linkColor: '#0563c1',
      headings: {
        1: { size: '20pt', color: '#1f4e79', weight: '700', marginTop: '16pt', marginBottom: '6pt', borderBottom: 'none' },
        2: { size: '15pt', color: '#2e74b5', weight: '700', marginTop: '14pt', marginBottom: '4pt', borderBottom: 'none' },
        3: { size: '13pt', color: '#1f4e79', weight: '700', marginTop: '12pt', marginBottom: '4pt', borderBottom: 'none' },
        4: { size: '11.5pt', color: '#2e74b5', weight: '700', marginTop: '10pt', marginBottom: '3pt', borderBottom: 'none' },
        5: { size: '11pt', color: '#1f4e79', weight: '700', marginTop: '8pt', marginBottom: '2pt', borderBottom: 'none' },
        6: { size: '11pt', color: '#595959', weight: '700', marginTop: '8pt', marginBottom: '2pt', borderBottom: 'none' }
      },
      tableBorder: '#bfbfbf',
      tableHeaderBg: '#e9eff7',
      tableHeaderColor: '#1f4e79',
      tableStripeBg: '#f9fbfd',
      inlineCodeBg: '#f2f2f2',
      inlineCodeColor: '#c7254e',
      codeBlockBg: '#f6f8fa',
      codeBlockBorder: '#d0d7de',
      codeHeaderBg: '#eaeef2',
      codeHeaderColor: '#4a5568',
      quoteBorder: '#2e74b5',
      quoteBg: '#f4f7fb',
      quoteColor: '#333333',
      hrColor: '#d0d7de',
      checkColor: '#185abd'
    }
  };

  // GitHub-style Callout/Alert color palettes
  const ALERT_STYLES = {
    NOTE:      { label: 'Note',      border: '#1a73e8', bg: '#eff6ff', titleColor: '#1d4ed8' },
    TIP:       { label: 'Tip',       border: '#16a34a', bg: '#f0fdf4', titleColor: '#15803d' },
    IMPORTANT: { label: 'Important', border: '#7c3aed', bg: '#f5f3ff', titleColor: '#6d28d9' },
    WARNING:   { label: 'Warning',   border: '#d97706', bg: '#fffbeb', titleColor: '#b45309' },
    CAUTION:   { label: 'Caution',   border: '#dc2626', bg: '#fef2f2', titleColor: '#b91c1c' }
  };

  // GitHub Light syntax highlighting map (converted directly to inline CSS)
  const HLJS_INLINE_STYLES = {
    'hljs-comment': 'color: #6e7781; font-style: italic;',
    'hljs-quote': 'color: #6e7781; font-style: italic;',
    'hljs-doctag': 'color: #cf222e;',
    'hljs-keyword': 'color: #cf222e; font-weight: 600;',
    'hljs-selector-tag': 'color: #116329;',
    'hljs-template-tag': 'color: #cf222e;',
    'hljs-template-variable': 'color: #0550ae;',
    'hljs-type': 'color: #953800;',
    'hljs-variable': 'color: #953800;',
    'hljs-variable.language_': 'color: #cf222e;',
    'hljs-variable.constant_': 'color: #0550ae;',
    'hljs-title': 'color: #8250df; font-weight: 600;',
    'hljs-title.class_': 'color: #953800; font-weight: 600;',
    'hljs-title.function_': 'color: #8250df;',
    'hljs-attr': 'color: #0550ae;',
    'hljs-attribute': 'color: #0550ae;',
    'hljs-literal': 'color: #0550ae;',
    'hljs-meta': 'color: #0550ae;',
    'hljs-number': 'color: #0550ae;',
    'hljs-operator': 'color: #cf222e;',
    'hljs-selector-attr': 'color: #0550ae;',
    'hljs-selector-class': 'color: #8250df;',
    'hljs-selector-id': 'color: #0550ae;',
    'hljs-string': 'color: #0a3069;',
    'hljs-regexp': 'color: #0a3069;',
    'hljs-built_in': 'color: #953800;',
    'hljs-symbol': 'color: #0550ae;',
    'hljs-name': 'color: #116329;',
    'hljs-tag': 'color: #116329;',
    'hljs-section': 'color: #0550ae; font-weight: 700;',
    'hljs-bullet': 'color: #953800;',
    'hljs-emphasis': 'font-style: italic;',
    'hljs-strong': 'font-weight: 700;',
    'hljs-addition': 'color: #116329; background-color: #dafbe1;',
    'hljs-deletion': 'color: #82071e; background-color: #ffebe9;',
    'hljs-params': 'color: #24292f;',
    'hljs-property': 'color: #0550ae;',
    'hljs-punctuation': 'color: #24292f;'
  };

  // ============================================================================
  // Built-in Sample Document (with inline SVG diagram auto-converted to PNG)
  // ============================================================================

  const SAMPLE_DIAGRAM_SVG =
    'data:image/svg+xml;charset=utf-8,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="540" height="120" viewBox="0 0 540 120">` +
      `<rect x="1" y="1" width="538" height="118" rx="10" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5"/>` +
      `<rect x="24" y="34" width="130" height="52" rx="8" fill="#ffffff" stroke="#94a3b8" stroke-width="1.5"/>` +
      `<text x="89" y="56" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" font-weight="700" fill="#0f172a">AI Markdown</text>` +
      `<text x="89" y="74" text-anchor="middle" font-family="Arial, sans-serif" font-size="10.5" fill="#64748b">Tables · Math · Code</text>` +
      `<line x1="154" y1="60" x2="196" y2="60" stroke="#1a73e8" stroke-width="2"/>` +
      `<polygon points="196,55 206,60 196,65" fill="#1a73e8"/>` +
      `<rect x="206" y="34" width="128" height="52" rx="8" fill="#e8f0fe" stroke="#1a73e8" stroke-width="1.5"/>` +
      `<text x="270" y="56" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" font-weight="700" fill="#1a73e8">MdToDocs</text>` +
      `<text x="270" y="74" text-anchor="middle" font-family="Arial, sans-serif" font-size="10.5" fill="#1e40af">Target Converter</text>` +
      `<line x1="334" y1="60" x2="376" y2="60" stroke="#1a73e8" stroke-width="2"/>` +
      `<polygon points="376,55 386,60 376,65" fill="#1a73e8"/>` +
      `<rect x="386" y="34" width="130" height="52" rx="8" fill="#ffffff" stroke="#16a34a" stroke-width="1.5"/>` +
      `<text x="451" y="56" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" font-weight="700" fill="#15803d">Docs / Word</text>` +
      `<text x="451" y="74" text-anchor="middle" font-family="Arial, sans-serif" font-size="10.5" fill="#475569">Clean Rich Paste</text>` +
      `</svg>`
    );

  const SAMPLE_MARKDOWN = `# Transformer Attention — Technical Summary

This sample demonstrates **bold**, *italic*, ~~strikethrough~~, ==highlighted text==, \`inline_code()\`, hyperlinks like [Attention Is All You Need](https://arxiv.org/abs/1706.03762), and footnotes[^1]. Currency values like $50–$100 stay untouched.

> [!TIP]
> Switch the **Target** selector above between **Google Docs** and **Microsoft Word** to see target-specific styling, fonts, and equation formats (crisp PNG images for Google Docs, native editable MathML equations for Microsoft Word).

## 1. Mathematical Formulation

Given query $Q$, key $K$, and value $V$ matrices with head dimension \\(d_k\\), scaled dot-product attention is defined as:

$$
\\operatorname{Attention}(Q, K, V) = \\operatorname{softmax}\\!\\left(\\frac{Q K^{\\top}}{\\sqrt{d_k}}\\right) V
$$

Multi-head attention concatenates $h$ parallel heads:

\\[
\\operatorname{MultiHead}(Q, K, V) = \\operatorname{Concat}(\\text{head}_1, \\dots, \\text{head}_h) W^O
\\]

## 2. Complexity Comparison Table

| Layer Type | Complexity per Layer | Sequential Ops | Max Path Length |
| :--- | :---: | :---: | ---: |
| Self-Attention | $O(n^2 \\cdot d)$ | $O(1)$ | $O(1)$ |
| Recurrent (RNN) | $O(n \\cdot d^2)$ | $O(n)$ | $O(n)$ |
| Convolutional | $O(k \\cdot n \\cdot d^2)$ | $O(1)$ | $O(\\log_k n)$ |

## 3. Reference Implementation

Use \`scaled_dot_product_attention(q, k, v)\` with optional causal masking:

\`\`\`python
import math
import torch
import torch.nn.functional as F

def scaled_dot_product_attention(q, k, v, mask=None):
    """Compute scaled dot-product attention."""
    d_k = q.size(-1)
    scores = torch.matmul(q, k.transpose(-2, -1)) / math.sqrt(d_k)
    if mask is not None:
        scores = scores.masked_fill(mask == 0, float("-inf"))
    weights = F.softmax(scores, dim=-1)
    return torch.matmul(weights, v), weights
\`\`\`

## 4. Pipeline Diagram & Checklist

![MdToDocs conversion pipeline](${SAMPLE_DIAGRAM_SVG} "Embedded diagram — automatically rasterized to PNG for seamless Google Docs and Word paste")

- [x] Preserve table borders, column alignment, and header shading
- [x] Render LaTeX equations (\`$...\$\`, \`$$...$$\`, \`\\(...\\)\`, \`\\[...\\]\`)
- [x] Keep code block indentation, borders, and syntax highlighting
- [ ] Paste into your target editor with \`Cmd/Ctrl + V\`

---

[^1]: Footnotes are automatically numbered and formatted cleanly at the bottom of the document.
`;

  // ============================================================================
  // Single-Pass Markdown Preprocessor (Math, Footnotes, Highlights)
  // ============================================================================

  /**
   * Walks markdown linearly so code fences & inline code spans are untouched,
   * while display & inline math ($..$, $$..$$, \(..\), \[..\]) are extracted
   * into safe placeholders before Marked runs.
   */
  function preprocessMarkdown(rawMd) {
    const mathItems = [];
    const footnoteDefs = new Map();
    const footnoteOrder = [];

    // 1. Normalize line endings
    let src = rawMd.replace(/\r\n?/g, '\n');

    // 2. Extract footnote definitions outside fenced code blocks
    src = extractFootnoteDefinitions(src, footnoteDefs);

    // 3. Single-pass scan for code blocks, inline code, math, ==mark==, and [^ref]
    let out = '';
    const len = src.length;
    let i = 0;

    while (i < len) {
      const atLineStart = i === 0 || src[i - 1] === '\n';

      // A. Fenced code block (``` or ~~~ with up to 3 leading spaces)
      if (atLineStart) {
        const fenceMatch = src.slice(i).match(/^([ ]{0,3})(`{3,}|~{3,})/);
        if (fenceMatch) {
          const fenceChar = fenceMatch[2][0];
          const fenceLen = fenceMatch[2].length;
          const lineEnd = src.indexOf('\n', i);
          if (lineEnd === -1) {
            out += src.slice(i);
            break;
          }
          // Find closing fence
          let pos = lineEnd + 1;
          let closeEnd = len;
          const closeRe = new RegExp(`^[ ]{0,3}${fenceChar}{${fenceLen},}[ \\t]*$`);
          while (pos < len) {
            const nextNl = src.indexOf('\n', pos);
            const line = nextNl === -1 ? src.slice(pos) : src.slice(pos, nextNl);
            if (closeRe.test(line)) {
              closeEnd = nextNl === -1 ? len : nextNl + 1;
              break;
            }
            if (nextNl === -1) break;
            pos = nextNl + 1;
          }
          out += src.slice(i, closeEnd);
          i = closeEnd;
          continue;
        }
      }

      // B. Inline code span (`...`, ``...``, etc.)
      if (src[i] === '`') {
        let tickLen = 0;
        while (i + tickLen < len && src[i + tickLen] === '`') tickLen++;
        const closer = '`'.repeat(tickLen);
        let searchPos = i + tickLen;
        let foundClose = -1;
        while (searchPos < len) {
          const idx = src.indexOf(closer, searchPos);
          if (idx === -1) break;
          // Ensure exact run length of backticks
          const beforeOk = idx === 0 || src[idx - 1] !== '`';
          const afterOk = idx + tickLen >= len || src[idx + tickLen] !== '`';
          if (beforeOk && afterOk) {
            foundClose = idx + tickLen;
            break;
          }
          searchPos = idx + 1;
        }
        if (foundClose !== -1) {
          out += src.slice(i, foundClose);
          i = foundClose;
          continue;
        } else {
          out += src.slice(i, i + tickLen);
          i += tickLen;
          continue;
        }
      }

      // C. Display math: $$ ... $$
      if (src[i] === '$' && src[i + 1] === '$' && (i === 0 || src[i - 1] !== '\\')) {
        const closeIdx = findClosingDelimiter(src, i + 2, '$$');
        if (closeIdx !== -1) {
          const tex = src.slice(i + 2, closeIdx).trim();
          if (tex.length > 0) {
            const id = mathItems.length;
            mathItems.push({ tex, display: true });
            out += `XMDMATHBLK${id}X`;
            i = closeIdx + 2;
            continue;
          }
        }
      }

      // D. Display math: \[ ... \]
      if (src[i] === '\\' && src[i + 1] === '[') {
        const closeIdx = findClosingDelimiter(src, i + 2, '\\]');
        if (closeIdx !== -1) {
          const tex = src.slice(i + 2, closeIdx).trim();
          if (tex.length > 0) {
            const id = mathItems.length;
            mathItems.push({ tex, display: true });
            out += `XMDMATHBLK${id}X`;
            i = closeIdx + 2;
            continue;
          }
        }
      }

      // E. Inline math: \( ... \)
      if (src[i] === '\\' && src[i + 1] === '(') {
        const closeIdx = findClosingDelimiter(src, i + 2, '\\)');
        if (closeIdx !== -1) {
          const tex = src.slice(i + 2, closeIdx).trim();
          if (tex.length > 0 && !tex.includes('\n\n')) {
            const id = mathItems.length;
            mathItems.push({ tex, display: false });
            out += `XMDMATHINL${id}X`;
            i = closeIdx + 2;
            continue;
          }
        }
      }

      // F. Inline math: $ ... $ (with currency safeguards)
      if (src[i] === '$' && src[i + 1] !== '$' && (i === 0 || src[i - 1] !== '\\')) {
        const nextChar = src[i + 1];
        if (nextChar && nextChar !== ' ' && nextChar !== '\t' && nextChar !== '\n') {
          const closeIdx = findClosingSingleDollar(src, i + 1);
          if (closeIdx !== -1) {
            const tex = src.slice(i + 1, closeIdx);
            const charAfter = src[closeIdx + 1] || '';
            const endsWithSpace = /\s$/.test(tex);
            // Reject currency ranges like $50-$100 or $5/$10 (closing $ followed by a digit)
            if (!endsWithSpace && !/\d/.test(charAfter) && tex.trim().length > 0) {
              const id = mathItems.length;
              mathItems.push({ tex: tex.trim(), display: false });
              out += `XMDMATHINL${id}X`;
              i = closeIdx + 1;
              continue;
            }
          }
        }
      }

      // G. Highlight syntax: ==highlighted text==
      if (src[i] === '=' && src[i + 1] === '=' && src[i + 2] !== '=') {
        const endMark = src.indexOf('==', i + 2);
        if (endMark !== -1) {
          const inner = src.slice(i + 2, endMark);
          if (inner.length > 0 && !inner.includes('\n') && !/^\s|\s$/.test(inner)) {
            out += `<mark>${inner}</mark>`;
            i = endMark + 2;
            continue;
          }
        }
      }

      // H. Footnote reference: [^id]
      if (src[i] === '[' && src[i + 1] === '^') {
        const refMatch = src.slice(i).match(/^\[\^([^\s\]]+)\]/);
        if (refMatch && footnoteDefs.has(refMatch[1])) {
          const fnKey = refMatch[1];
          let num = footnoteOrder.indexOf(fnKey) + 1;
          if (num === 0) {
            footnoteOrder.push(fnKey);
            num = footnoteOrder.length;
          }
          out += `<sup>[${num}]</sup>`;
          i += refMatch[0].length;
          continue;
        }
      }

      out += src[i];
      i++;
    }

    // Append formatted footnotes section if any were referenced
    if (footnoteOrder.length > 0) {
      out += '\n\n---\n\n';
      footnoteOrder.forEach((key, idx) => {
        const text = footnoteDefs.get(key) || '';
        out += `<sup data-footnote-def="true">[${idx + 1}]</sup> ${text}\n\n`;
      });
    }

    return { markdown: out, mathItems };
  }

  function extractFootnoteDefinitions(src, footnoteDefs) {
    const lines = src.split('\n');
    const kept = [];
    let inFence = false;
    let fenceChar = '';
    let fenceLen = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const fenceMatch = line.match(/^[ ]{0,3}(`{3,}|~{3,})/);
      if (fenceMatch) {
        if (!inFence) {
          inFence = true;
          fenceChar = fenceMatch[1][0];
          fenceLen = fenceMatch[1].length;
        } else if (fenceMatch[1][0] === fenceChar && fenceMatch[1].length >= fenceLen) {
          inFence = false;
        }
        kept.push(line);
        continue;
      }

      if (!inFence) {
        const defMatch = line.match(/^\[\^([^\s\]]+)\]:\s*(.*)$/);
        if (defMatch) {
          const key = defMatch[1];
          let content = defMatch[2];
          // Collect indented continuation lines
          while (i + 1 < lines.length && /^(?:    |\t)\S/.test(lines[i + 1])) {
            i++;
            content += ' ' + lines[i].trim();
          }
          footnoteDefs.set(key, content.trim());
          continue;
        }
      }

      kept.push(line);
    }

    return kept.join('\n');
  }

  function findClosingDelimiter(str, startIdx, delim) {
    let pos = startIdx;
    while (pos < str.length) {
      const idx = str.indexOf(delim, pos);
      if (idx === -1) return -1;
      // Check if escaped (count preceding backslashes)
      let backslashes = 0;
      let k = idx - 1;
      while (k >= startIdx && str[k] === '\\') {
        backslashes++;
        k--;
      }
      if (backslashes % 2 === 0) return idx;
      pos = idx + 1;
    }
    return -1;
  }

  function findClosingSingleDollar(str, startIdx) {
    let pos = startIdx;
    while (pos < str.length) {
      const ch = str[pos];
      if (ch === '\n') return -1; // Keep single-$ inline math on one line
      if (ch === '\\') {
        pos += 2;
        continue;
      }
      if (ch === '$') {
        if (str[pos + 1] === '$') return -1;
        return pos;
      }
      pos++;
    }
    return -1;
  }

  // ============================================================================
  // Math Rendering Engines (PNG via MathJax SVG->Canvas, MathML, Unicode, LaTeX)
  // ============================================================================

  async function ensureMathJaxReady() {
    if (state.mathJaxReady) return true;
    if (!window.MathJax) return false;
    try {
      if (window.MathJax.startup && window.MathJax.startup.promise) {
        await window.MathJax.startup.promise;
      }
      state.mathJaxReady = typeof window.MathJax.tex2svg === 'function';
      return state.mathJaxReady;
    } catch (err) {
      console.warn('MathJax failed to initialize:', err);
      return false;
    }
  }

  async function renderMathToPng(tex, display) {
    const key = `${display ? 'D' : 'I'}:${tex}`;
    if (mathPngCache.has(key)) return mathPngCache.get(key);

    const ready = await ensureMathJaxReady();
    if (!ready || typeof window.MathJax.tex2svg !== 'function') {
      return null;
    }

    try {
      const wrapper = window.MathJax.tex2svg(tex, { display });
      const svg = wrapper.querySelector('svg');
      if (!svg) return null;

      const svgClone = svg.cloneNode(true);
      const widthEx = parseEx(svgClone.getAttribute('width')) || 4;
      const heightEx = parseEx(svgClone.getAttribute('height')) || 2;
      const vaEx = parseEx(svgClone.style.verticalAlign) || 0;

      const pxPerEx = display ? 8.6 : 7.8;
      const drawW = Math.max(8, Math.ceil(widthEx * pxPerEx));
      const drawH = Math.max(10, Math.ceil(heightEx * pxPerEx));
      const pad = 2;
      const totalW = drawW + pad * 2;
      const totalH = drawH + pad * 2;
      const vaPx = Math.round(vaEx * pxPerEx);

      svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      svgClone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
      svgClone.setAttribute('width', `${drawW}px`);
      svgClone.setAttribute('height', `${drawH}px`);
      svgClone.removeAttribute('style');

      let svgStr = new XMLSerializer().serializeToString(svgClone);
      svgStr = svgStr.replace(/currentColor/g, '#1f1f1f');

      const dataUrl = await svgStringToPngDataUrl(svgStr, totalW, totalH, pad, drawW, drawH, 3);
      const result = { dataUrl, width: totalW, height: totalH, verticalAlign: vaPx };
      mathPngCache.set(key, result);
      return result;
    } catch (err) {
      console.warn('Math PNG render failed for:', tex, err);
      return null;
    }
  }

  function parseEx(val) {
    if (!val) return 0;
    const m = String(val).match(/(-?[\d.]+)\s*ex/i);
    return m ? parseFloat(m[1]) : 0;
  }

  function svgStringToPngDataUrl(svgStr, totalW, totalH, pad, drawW, drawH, scale = 3) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(totalW * scale);
          canvas.height = Math.round(totalH * scale);
          const ctx = canvas.getContext('2d');
          ctx.scale(scale, scale);
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, pad, pad, drawW, drawH);
          resolve(canvas.toDataURL('image/png'));
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = (err) => reject(err);
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr);
    });
  }

  async function renderMathToMathML(tex, display) {
    const key = `${display ? 'D' : 'I'}:${tex}`;
    if (mathMmlCache.has(key)) return mathMmlCache.get(key);

    const ready = await ensureMathJaxReady();
    if (!ready || typeof window.MathJax.tex2mml !== 'function') {
      return null;
    }

    try {
      let mml = window.MathJax.tex2mml(tex, { display });
      // Strip MathJax internal data attributes so Microsoft Word's MathML->OMML converter parses cleanly
      mml = mml.replace(/\sdata-mjx-[a-z-]+="[^"]*"/gi, '');
      mml = mml.replace(/\sclass="[^"]*"/gi, '');
      mathMmlCache.set(key, mml);
      return mml;
    } catch (err) {
      console.warn('MathML render failed for:', tex, err);
      return null;
    }
  }

  /**
   * Converts common LaTeX math into clean editable Unicode + <sup>/<sub> HTML.
   */
  function texToUnicodeHtml(tex) {
    const GREEK = {
      alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε',
      zeta: 'ζ', eta: 'η', theta: 'θ', vartheta: 'ϑ', iota: 'ι', kappa: 'κ',
      lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', varpi: 'ϖ', rho: 'ρ',
      varrho: 'ϱ', sigma: 'σ', varsigma: 'ς', tau: 'τ', upsilon: 'υ', phi: 'φ',
      varphi: 'ϕ', chi: 'χ', psi: 'ψ', omega: 'ω',
      Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π',
      Sigma: 'Σ', Upsilon: 'Υ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω'
    };

    const SYMBOLS = {
      times: '×', cdot: '·', cdotp: '·', div: '÷', pm: '±', mp: '∓',
      leq: '≤', le: '≤', geq: '≥', ge: '≥', neq: '≠', ne: '≠',
      approx: '≈', equiv: '≡', sim: '∼', simeq: '≃', cong: '≅', propto: '∝',
      infty: '∞', partial: '∂', nabla: '∇',
      sum: '∑', prod: '∏', int: '∫', iint: '∬', oint: '∮',
      to: '→', rightarrow: '→', leftarrow: '←', leftrightarrow: '↔',
      Rightarrow: '⇒', Leftarrow: '⇐', Leftrightarrow: '⇔', mapsto: '↦',
      in: '∈', notin: '∉', subset: '⊂', subseteq: '⊆', supset: '⊃', supseteq: '⊇',
      cup: '∪', cap: '∩', emptyset: '∅', varnothing: '∅',
      forall: '∀', exists: '∃', neg: '¬', land: '∧', lor: '∨',
      top: '⊤', bot: '⊥', perp: '⊥', parallel: '∥', angle: '∠',
      dots: '…', ldots: '…', cdots: '⋯', vdots: '⋮', ddots: '⋱',
      star: '⋆', circ: '∘', bullet: '•', oplus: '⊕', otimes: '⊗',
      ell: 'ℓ', hbar: 'ℏ', Re: 'ℜ', Im: 'ℑ', aleph: 'ℵ', prime: '′',
      quad: '  ', qquad: '    ', ',': ' ', ';': ' ', ':': ' ', '!': ''
    };

    let s = tex.trim();
    // Remove \left and \right sizing directives
    s = s.replace(/\\(?:left|right|big|Big|bigg|Bigg)\b/g, '');
    // Unwrap operatorname / text / mathrm / mathbf / mathit
    s = s.replace(/\\(?:operatorname|text|textrm|mathrm|mathsf|texttt)\{([^{}]*)\}/g, '$1');
    s = s.replace(/\\(?:mathbf|boldsymbol|bm)\{([^{}]*)\}/g, '<b>$1</b>');
    s = s.replace(/\\mathbb\{R\}/g, 'ℝ').replace(/\\mathbb\{N\}/g, 'ℕ')
         .replace(/\\mathbb\{Z\}/g, 'ℤ').replace(/\\mathbb\{Q\}/g, 'ℚ')
         .replace(/\\mathbb\{C\}/g, 'ℂ').replace(/\\mathbb\{E\}/g, '𝔼');
    s = s.replace(/\\mathbb\{([^{}]*)\}/g, '$1');

    // Simple nested \frac{a}{b} (iterate up to 3 levels)
    for (let pass = 0; pass < 3; pass++) {
      s = s.replace(/\\d?frac\{([^{}]+)\}\{([^{}]+)\}/g, '($1)/($2)');
      s = s.replace(/\\sqrt\{([^{}]+)\}/g, '√($1)');
    }

    // Standard math function names
    s = s.replace(/\\(sin|cos|tan|cot|sec|csc|arcsin|arccos|arctan|sinh|cosh|tanh|log|ln|exp|lim|sup|inf|max|min|arg|det|dim|gcd|Pr|deg|mod|softmax|Concat)\b/g, '$1');

    // Escaped braces & spaces
    s = s.replace(/\\\{/g, '{').replace(/\\\}/g, '}').replace(/\\([,;:! ])/g, (_, c) => SYMBOLS[c] ?? ' ');

    // Replace Greek & symbol commands
    s = s.replace(/\\([a-zA-Z]+)/g, (_, cmd) => {
      if (GREEK[cmd]) return GREEK[cmd];
      if (SYMBOLS[cmd] !== undefined) return SYMBOLS[cmd];
      return cmd;
    });

    // Escape HTML special chars safely (preserving <b> tags we inserted)
    s = s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/&lt;b&gt;(.*?)&lt;\/b&gt;/g, '<b>$1</b>');

    // Superscripts & Subscripts
    s = s.replace(/\^\{([^{}]+)\}/g, '<sup>$1</sup>');
    s = s.replace(/_\{([^{}]+)\}/g, '<sub>$1</sub>');
    s = s.replace(/\^([A-Za-z0-9+\-⊤′])/g, '<sup>$1</sup>');
    s = s.replace(/_([A-Za-z0-9+\-])/g, '<sub>$1</sub>');

    // Clean leftover standalone braces
    s = s.replace(/[{}]/g, '');

    return s.trim();
  }

  async function renderMathExpression(item, mode, profile) {
    const { tex, display } = item;
    const escapedTex = escapeHtml(tex);

    if (mode === 'png') {
      const png = await renderMathToPng(tex, display);
      if (png) {
        if (display) {
          return `<p style="text-align: center; margin: 10pt 0; padding: 0; line-height: 1.2;"><img src="${png.dataUrl}" alt="${escapedTex}" width="${png.width}" height="${png.height}" style="vertical-align: middle; max-width: 100%; height: auto;"></p>`;
        }
        return `<img src="${png.dataUrl}" alt="${escapedTex}" width="${png.width}" height="${png.height}" style="vertical-align: ${png.verticalAlign}px; display: inline; max-width: 100%;">`;
      }
      // Graceful fallback to Unicode if MathJax couldn't load (e.g., offline)
      mode = 'unicode';
    }

    if (mode === 'mathml') {
      const mml = await renderMathToMathML(tex, display);
      if (mml) {
        if (display) {
          return `<p style="text-align: center; margin: 10pt 0; padding: 0;">${mml}</p>`;
        }
        return mml;
      }
      mode = 'unicode';
    }

    if (mode === 'unicode') {
      const uni = texToUnicodeHtml(tex);
      if (display) {
        return `<p style="text-align: center; margin: 10pt 0; font-family: ${profile.mathSerifFamily}; font-size: 12pt; color: ${profile.textColor};">${uni}</p>`;
      }
      return `<span style="font-family: ${profile.mathSerifFamily}; font-style: italic; color: ${profile.textColor};">${uni}</span>`;
    }

    // Raw LaTeX mode (useful for Google Docs Auto-LaTeX Equations add-on)
    if (display) {
      return `<p style="text-align: center; margin: 10pt 0; font-family: ${profile.monoFamily}; font-size: 10pt; color: ${profile.textColor};">$$${escapedTex}$$</p>`;
    }
    return `<span style="font-family: ${profile.monoFamily}; font-size: 10pt; color: ${profile.textColor};">$${escapedTex}$</span>`;
  }

  // ============================================================================
  // Syntax Highlighting with Inline Styles (Google Docs & Word Compatible)
  // ============================================================================

  function highlightCodeInline(rawCode, lang) {
    let highlightedHtml = '';
    if (window.hljs) {
      try {
        if (lang && window.hljs.getLanguage(lang)) {
          highlightedHtml = window.hljs.highlight(rawCode, { language: lang, ignoreIllegals: true }).value;
        } else {
          highlightedHtml = window.hljs.highlightAuto(rawCode).value;
        }
      } catch (_) {
        highlightedHtml = escapeHtml(rawCode);
      }
    } else {
      highlightedHtml = escapeHtml(rawCode);
    }

    // Convert hljs classes into explicit inline style="color:..."
    const temp = document.createElement('div');
    temp.innerHTML = highlightedHtml;

    const spans = temp.querySelectorAll('span');
    spans.forEach((span) => {
      const classes = Array.from(span.classList);
      let style = '';
      // Prefer more specific compound class names (e.g., hljs-title.function_) if present
      if (classes.length >= 2) {
        const compound = classes.join('.');
        if (HLJS_INLINE_STYLES[compound]) {
          style = HLJS_INLINE_STYLES[compound];
        }
      }
      if (!style) {
        for (const cls of classes) {
          if (HLJS_INLINE_STYLES[cls]) {
            style = HLJS_INLINE_STYLES[cls];
            break;
          }
        }
      }
      span.removeAttribute('class');
      if (style) {
        span.setAttribute('style', style);
      }
    });

    // Preserve indentation & newlines reliably in Google Docs and Microsoft Word
    return preserveCodeWhitespace(temp.innerHTML);
  }

  function preserveCodeWhitespace(html) {
    // Split by HTML tags so we only modify text runs, never tag attributes
    const parts = html.split(/(<[^>]+>)/g);
    let atLineStart = true;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!part || part.startsWith('<')) continue;

      let out = '';
      for (let j = 0; j < part.length; j++) {
        const ch = part[j];
        if (ch === '\n') {
          out += '<br>';
          atLineStart = true;
        } else if (ch === '\t') {
          out += '&nbsp;&nbsp;&nbsp;&nbsp;';
        } else if (ch === ' ') {
          if (atLineStart || part[j + 1] === ' ' || part[j - 1] === ' ') {
            out += '&nbsp;';
          } else {
            out += ' ';
          }
        } else {
          out += ch;
          atLineStart = false;
        }
      }
      parts[i] = out;
    }

    return parts.join('');
  }

  // ============================================================================
  // SVG Image Data-URI Rasterizer (so SVG images paste cleanly into Docs & Word)
  // ============================================================================

  async function rasterizeSvgDataUri(dataUri) {
    if (svgRasterCache.has(dataUri)) return svgRasterCache.get(dataUri);

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const w = img.naturalWidth || 540;
          const h = img.naturalHeight || 160;
          const scale = 2;
          const canvas = document.createElement('canvas');
          canvas.width = w * scale;
          canvas.height = h * scale;
          const ctx = canvas.getContext('2d');
          ctx.scale(scale, scale);
          ctx.drawImage(img, 0, 0, w, h);
          const result = { dataUrl: canvas.toDataURL('image/png'), width: w, height: h };
          svgRasterCache.set(dataUri, result);
          resolve(result);
        } catch (_) {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = dataUri;
    });
  }

  // ============================================================================
  // DOM Transformation Engine (Inline Styles & Target Structure)
  // ============================================================================

  async function convertMarkdown(rawMd, target, mathMode) {
    const profile = PROFILES[target];
    if (!rawMd.trim()) {
      return {
        bodyHtml: '',
        clipboardHtml: '',
        plainText: '',
        counts: { tables: 0, equations: 0, codeBlocks: 0, images: 0 }
      };
    }

    // 1. Preprocess math, highlights, footnotes
    const { markdown, mathItems } = preprocessMarkdown(rawMd);

    // 2. Parse Markdown to HTML via Marked (GFM)
    let rawHtml = '';
    if (window.marked) {
      rawHtml = window.marked.parse(markdown, {
        gfm: true,
        breaks: false
      });
    } else {
      rawHtml = `<p>${escapeHtml(markdown).replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`;
    }

    // 3. Sanitize HTML via DOMPurify (allowing safe data:image URIs & rich elements)
    let cleanHtml = rawHtml;
    if (window.DOMPurify) {
      cleanHtml = window.DOMPurify.sanitize(rawHtml, {
        ADD_TAGS: ['mark', 'kbd', 'u', 's', 'del', 'sup', 'sub', 'figure', 'figcaption'],
        ADD_ATTR: ['align', 'data-footnote-def', 'checked', 'disabled', 'type'],
        ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|data:image\/(?:png|jpeg|jpg|gif|webp|svg\+xml);)/i
      });
    }

    // 4. Parse into detached DOM container & transform for target editor
    const root = document.createElement('div');
    root.innerHTML = cleanHtml;

    const counts = {
      tables: root.querySelectorAll('table').length,
      equations: mathItems.length,
      codeBlocks: root.querySelectorAll('pre > code').length,
      images: root.querySelectorAll('img').length
    };

    // Transform code blocks BEFORE inline code
    transformCodeBlocks(root, profile, target);

    // Transform blockquotes & GitHub alerts
    transformBlockquotes(root, profile, target);

    // Transform tables (only original markdown tables, not code/quote layout tables)
    transformDataTables(root, profile, target);

    // Transform headings, paragraphs, lists, inline code, links, images, hr, mark, kbd
    await transformTypographyAndMedia(root, profile, target);

    // 5. Render & inject all math expressions in parallel
    if (mathItems.length > 0) {
      const renderedMath = await Promise.all(
        mathItems.map((item) => renderMathExpression(item, mathMode, profile))
      );

      let html = root.innerHTML;
      // Replace standalone block-math paragraphs first to avoid nested <p><p>...</p></p>
      renderedMath.forEach((mathHtml, idx) => {
        if (mathItems[idx].display) {
          const pBlockRe = new RegExp(`<p[^>]*>\\s*XMDMATHBLK${idx}X\\s*<\\/p>`, 'g');
          html = html.replace(pBlockRe, mathHtml);
          // If still embedded inside a paragraph with surrounding text, unwrap outer <p> into a centered span block
          const embeddedMath = mathHtml
            .replace(/^<p\b[^>]*>/i, '<span style="display: block; text-align: center; margin: 8pt 0;">')
            .replace(/<\/p>$/i, '</span>');
          html = html.replace(new RegExp(`XMDMATHBLK${idx}X`, 'g'), embeddedMath);
        } else {
          html = html.replace(new RegExp(`XMDMATHINL${idx}X`, 'g'), mathHtml);
        }
      });
      root.innerHTML = html;
    }

    const bodyHtml = root.innerHTML;
    const clipboardHtml = buildClipboardHtml(bodyHtml, profile, target);
    const plainText = root.textContent || rawMd;

    return { bodyHtml, clipboardHtml, plainText, counts };
  }

  function transformCodeBlocks(root, profile, target) {
    const pres = Array.from(root.querySelectorAll('pre'));
    pres.forEach((pre) => {
      const codeEl = pre.querySelector('code');
      const rawCode = (codeEl ? codeEl.textContent : pre.textContent).replace(/\n$/, '');

      let lang = '';
      if (codeEl) {
        const langClass = Array.from(codeEl.classList).find((c) => c.startsWith('language-'));
        if (langClass) lang = langClass.replace('language-', '');
      }

      const highlighted = highlightCodeInline(rawCode, lang);
      const isWord = target === 'word';
      const borderStyle = isWord
        ? `border: 1pt solid ${profile.codeBlockBorder}; mso-border-alt: solid ${profile.codeBlockBorder} .5pt;`
        : `border: 1px solid ${profile.codeBlockBorder};`;

      const table = document.createElement('table');
      table.setAttribute('data-layout-table', 'code');
      table.setAttribute('cellpadding', '0');
      table.setAttribute('cellspacing', '0');
      table.setAttribute(
        'style',
        `border-collapse: collapse; width: 100%; margin: 10pt 0; table-layout: fixed;`
      );

      const tbody = document.createElement('tbody');

      if (lang) {
        const headerTr = document.createElement('tr');
        const headerTd = document.createElement('td');
        headerTd.setAttribute(
          'style',
          `${borderStyle} background-color: ${profile.codeHeaderBg}; color: ${profile.codeHeaderColor}; font-family: ${profile.fontFamily}; font-size: 8.5pt; font-weight: 700; padding: 3.5pt 10pt; text-transform: uppercase; letter-spacing: 0.04em;`
        );
        headerTd.textContent = lang;
        headerTr.appendChild(headerTd);
        tbody.appendChild(headerTr);
      }

      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.setAttribute(
        'style',
        `${borderStyle} background-color: ${profile.codeBlockBg}; padding: 9pt 11pt; vertical-align: top;`
      );

      const p = document.createElement('p');
      p.setAttribute(
        'style',
        `margin: 0; padding: 0; font-family: ${profile.monoFamily}; font-size: 9.5pt; line-height: 1.45; color: #24292f; white-space: pre-wrap; word-break: break-word;`
      );
      p.innerHTML = highlighted;

      td.appendChild(p);
      tr.appendChild(td);
      tbody.appendChild(tr);
      table.appendChild(tbody);

      pre.parentNode.replaceChild(table, pre);
    });
  }

  function transformBlockquotes(root, profile, target) {
    // Process deepest blockquotes first
    const quotes = Array.from(root.querySelectorAll('blockquote')).reverse();
    quotes.forEach((bq) => {
      // Check for GitHub-style alert: [!NOTE], [!TIP], [!IMPORTANT], [!WARNING], [!CAUTION]
      let alertMeta = null;
      const firstP = bq.querySelector('p');
      if (firstP) {
        const alertMatch = firstP.innerHTML.match(/^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(?:<br\s*\/?>|\n)?/i);
        if (alertMatch) {
          alertMeta = ALERT_STYLES[alertMatch[1].toUpperCase()];
          firstP.innerHTML = firstP.innerHTML.replace(alertMatch[0], '').trim();
          if (!firstP.innerHTML) firstP.remove();
        }
      }

      const borderColor = alertMeta ? alertMeta.border : profile.quoteBorder;
      const bgColor = alertMeta ? alertMeta.bg : profile.quoteBg;
      const textColor = alertMeta ? profile.textColor : profile.quoteColor;

      const table = document.createElement('table');
      table.setAttribute('data-layout-table', 'quote');
      table.setAttribute('cellpadding', '0');
      table.setAttribute('cellspacing', '0');
      table.setAttribute(
        'style',
        `border-collapse: collapse; width: 100%; margin: 10pt 0;`
      );

      const tbody = document.createElement('tbody');
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      const wordBorder = target === 'word'
        ? `mso-border-left-alt: solid ${borderColor} 3pt;`
        : '';

      td.setAttribute(
        'style',
        `border-left: 3pt solid ${borderColor}; border-top: none; border-right: none; border-bottom: none; ${wordBorder} background-color: ${bgColor}; padding: 8pt 12pt; color: ${textColor}; font-family: ${profile.fontFamily}; font-size: ${profile.fontSize}; line-height: ${profile.lineHeight};`
      );

      if (alertMeta) {
        const titleP = document.createElement('p');
        titleP.setAttribute(
          'style',
          `margin: 0 0 4pt 0; font-family: ${profile.fontFamily}; font-size: 10.5pt; font-weight: 700; color: ${alertMeta.titleColor};`
        );
        titleP.textContent = alertMeta.label;
        td.appendChild(titleP);
      }

      while (bq.firstChild) {
        td.appendChild(bq.firstChild);
      }

      // Remove bottom margin on last paragraph inside quote
      const lastP = td.lastElementChild;
      if (lastP && lastP.tagName === 'P') {
        lastP.setAttribute('data-compact-bottom', 'true');
      }

      tr.appendChild(td);
      tbody.appendChild(tr);
      table.appendChild(tbody);
      bq.parentNode.replaceChild(table, bq);
    });
  }

  function transformDataTables(root, profile, target) {
    const tables = Array.from(root.querySelectorAll('table')).filter(
      (t) => !t.hasAttribute('data-layout-table')
    );

    const isWord = target === 'word';
    const cellBorder = isWord
      ? `border: 1pt solid ${profile.tableBorder}; mso-border-alt: solid ${profile.tableBorder} .5pt;`
      : `border: 1px solid ${profile.tableBorder};`;

    tables.forEach((table) => {
      table.setAttribute('cellpadding', '0');
      table.setAttribute('cellspacing', '0');
      table.setAttribute(
        'style',
        `border-collapse: collapse; width: 100%; margin: 10pt 0; font-family: ${profile.fontFamily}; font-size: 10.5pt; line-height: 1.4; color: ${profile.textColor};`
      );

      const rows = Array.from(table.querySelectorAll('tr'));
      rows.forEach((tr, rowIdx) => {
        const cells = Array.from(tr.children).filter(
          (el) => el.tagName === 'TH' || el.tagName === 'TD'
        );
        const isHeaderRow = tr.parentElement && tr.parentElement.tagName === 'THEAD';
        const isEvenDataRow = !isHeaderRow && rowIdx % 2 === 0;

        cells.forEach((cell) => {
          const align =
            cell.getAttribute('align') ||
            cell.style.textAlign ||
            'left';
          const isTh = cell.tagName === 'TH' || isHeaderRow;
          const bg = isTh
            ? profile.tableHeaderBg
            : isEvenDataRow
              ? profile.tableStripeBg
              : '#ffffff';
          const weight = isTh ? 'font-weight: 700;' : 'font-weight: 400;';
          const color = isTh ? profile.tableHeaderColor : profile.textColor;

          cell.setAttribute('align', align);
          cell.setAttribute(
            'style',
            `${cellBorder} background-color: ${bg}; color: ${color}; ${weight} text-align: ${align}; padding: 6pt 9pt; vertical-align: top; font-family: ${profile.fontFamily}; font-size: 10.5pt;`
          );
        });
      });
    });
  }

  async function transformTypographyAndMedia(root, profile, target) {
    // Headings H1-H6
    for (let level = 1; level <= 6; level++) {
      const hSpec = profile.headings[level];
      root.querySelectorAll(`h${level}`).forEach((h) => {
        const wordExtra =
          target === 'word'
            ? `mso-outline-level: ${level}; page-break-after: avoid;`
            : '';
        h.setAttribute(
          'style',
          `font-family: ${profile.fontFamily}; font-size: ${hSpec.size}; font-weight: ${hSpec.weight}; color: ${hSpec.color}; margin: ${hSpec.marginTop} 0 ${hSpec.marginBottom} 0; line-height: 1.25; ${wordExtra}`
        );
      });
    }

    // Paragraphs (skip ones already styled by code blocks or alert headers)
    root.querySelectorAll('p').forEach((p) => {
      if (p.hasAttribute('style')) return;
      const fnMarker = p.querySelector(':scope > sup[data-footnote-def]');
      const isFootnote = Boolean(fnMarker);
      if (fnMarker) fnMarker.removeAttribute('data-footnote-def');
      const isCompact = p.hasAttribute('data-compact-bottom');
      const marginBottom = isCompact ? '0' : isFootnote ? '4pt' : '8pt';
      const fontSize = isFootnote ? '9.5pt' : profile.fontSize;
      const color = isFootnote ? profile.mutedColor : profile.textColor;

      p.removeAttribute('data-compact-bottom');
      p.setAttribute(
        'style',
        `margin: 0 0 ${marginBottom} 0; font-family: ${profile.fontFamily}; font-size: ${fontSize}; line-height: ${profile.lineHeight}; color: ${color};`
      );
    });

    // Lists & Task Lists
    root.querySelectorAll('ul, ol').forEach((list) => {
      const isNested = list.parentElement && list.parentElement.tagName === 'LI';
      const margin = isNested ? '3pt 0 3pt 0' : '4pt 0 10pt 0';
      list.setAttribute(
        'style',
        `margin: ${margin}; padding-left: 20pt; font-family: ${profile.fontFamily}; font-size: ${profile.fontSize}; line-height: ${profile.lineHeight}; color: ${profile.textColor};`
      );
    });

    root.querySelectorAll('li').forEach((li) => {
      // Replace checkbox inputs with clean Unicode checkboxes (Docs & Word drop <input>)
      const checkbox = li.querySelector(':scope > input[type="checkbox"], :scope > p > input[type="checkbox"]');
      if (checkbox) {
        const checked = checkbox.hasAttribute('checked') || checkbox.checked;
        const symbol = document.createElement('span');
        symbol.setAttribute(
          'style',
          `color: ${checked ? profile.checkColor : profile.mutedColor}; font-weight: 700; margin-right: 4pt;`
        );
        symbol.textContent = checked ? '☑ ' : '☐ ';
        checkbox.parentNode.replaceChild(symbol, checkbox);
        li.setAttribute(
          'style',
          `list-style-type: none; margin: 0 0 4pt -14pt; font-family: ${profile.fontFamily}; font-size: ${profile.fontSize}; line-height: ${profile.lineHeight}; color: ${profile.textColor};`
        );
      } else {
        li.setAttribute(
          'style',
          `margin: 0 0 4pt 0; font-family: ${profile.fontFamily}; font-size: ${profile.fontSize}; line-height: ${profile.lineHeight}; color: ${profile.textColor};`
        );
      }
    });

    // Inline code (all remaining <code> elements outside code blocks)
    Array.from(root.querySelectorAll('code')).forEach((code) => {
      const span = document.createElement('span');
      const wordHighlight = target === 'word' ? `mso-highlight: ${profile.inlineCodeBg};` : '';
      span.setAttribute(
        'style',
        `font-family: ${profile.monoFamily}; font-size: 9.5pt; background-color: ${profile.inlineCodeBg}; ${wordHighlight} color: ${profile.inlineCodeColor}; padding: 1pt 3.5pt;`
      );
      span.innerHTML = code.innerHTML;
      code.parentNode.replaceChild(span, code);
    });

    // Links
    root.querySelectorAll('a').forEach((a) => {
      a.setAttribute(
        'style',
        `color: ${profile.linkColor}; text-decoration: underline;`
      );
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
    });

    // Horizontal Rules
    root.querySelectorAll('hr').forEach((hr) => {
      hr.setAttribute(
        'style',
        `border: none; border-top: 1px solid ${profile.hrColor}; margin: 14pt 0;`
      );
    });

    // Highlight <mark>
    root.querySelectorAll('mark').forEach((mark) => {
      const span = document.createElement('span');
      span.setAttribute(
        'style',
        `background-color: #fef08a; color: ${profile.textColor}; padding: 0 2pt;`
      );
      span.innerHTML = mark.innerHTML;
      mark.parentNode.replaceChild(span, mark);
    });

    // Keyboard <kbd>
    root.querySelectorAll('kbd').forEach((kbd) => {
      const span = document.createElement('span');
      span.setAttribute(
        'style',
        `font-family: ${profile.monoFamily}; font-size: 9pt; background-color: ${profile.inlineCodeBg}; border: 1px solid ${profile.tableBorder}; padding: 1pt 4pt; color: ${profile.textColor};`
      );
      span.innerHTML = kbd.innerHTML;
      kbd.parentNode.replaceChild(span, kbd);
    });

    // Images (rasterize inline SVG data URIs to PNG so Google Docs & Word preserve them!)
    const imgs = Array.from(root.querySelectorAll('img'));
    for (const img of imgs) {
      const src = img.getAttribute('src') || '';
      const title = img.getAttribute('title') || '';

      if (src.startsWith('data:image/svg+xml')) {
        const png = await rasterizeSvgDataUri(src);
        if (png) {
          img.setAttribute('src', png.dataUrl);
          img.setAttribute('width', String(png.width));
          img.setAttribute('height', String(png.height));
        }
      }

      img.setAttribute('style', 'max-width: 100%; height: auto; display: inline-block; margin: 4pt 0;');

      // If image has a title attribute and is alone in a paragraph, render a neat caption below
      if (title && img.parentElement && img.parentElement.tagName === 'P' && img.parentElement.childNodes.length === 1) {
        const caption = document.createElement('p');
        caption.setAttribute(
          'style',
          `margin: 2pt 0 10pt 0; font-family: ${profile.fontFamily}; font-size: 9.5pt; font-style: italic; color: ${profile.mutedColor}; text-align: center;`
        );
        caption.textContent = title;
        img.parentElement.style.textAlign = 'center';
        img.parentElement.style.marginBottom = '2pt';
        img.parentElement.insertAdjacentElement('afterend', caption);
      }
    }

    // Clean internal data attributes before export
    root.querySelectorAll('[data-layout-table]').forEach((el) => {
      el.removeAttribute('data-layout-table');
    });
  }

  function buildClipboardHtml(bodyHtml, profile, target) {
    if (target === 'word') {
      return (
        `<html xmlns:o="urn:schemas-microsoft-com:office:office" ` +
        `xmlns:w="urn:schemas-microsoft-com:office:word" ` +
        `xmlns:m="http://schemas.microsoft.com/office/2004/12/omml" ` +
        `xmlns="http://www.w3.org/TR/REC-html40">\n` +
        `<head>\n` +
        `<meta charset="utf-8">\n` +
        `<style>\n` +
        `  body { font-family: ${profile.fontFamily}; font-size: ${profile.fontSize}; color: ${profile.textColor}; line-height: ${profile.lineHeight}; }\n` +
        `  table { border-collapse: collapse; }\n` +
        `  p { margin: 0 0 8pt 0; }\n` +
        `</style>\n` +
        `</head>\n` +
        `<body lang="EN-US" link="${profile.linkColor}" vlink="#954f72">\n` +
        `<!--StartFragment-->\n` +
        `${bodyHtml}\n` +
        `<!--EndFragment-->\n` +
        `</body>\n` +
        `</html>`
      );
    }

    // Google Docs works best with a clean inline-styled wrapper div (no heavy Office headers)
    return `<div style="font-family: ${profile.fontFamily}; font-size: ${profile.fontSize}; color: ${profile.textColor}; line-height: ${profile.lineHeight};">${bodyHtml}</div>`;
  }

  // ============================================================================
  // Clipboard & File Export
  // ============================================================================

  async function copyFormattedDocument() {
    if (!state.renderedBodyHtml) {
      showToast('Nothing to copy — paste some Markdown first.', true);
      return;
    }

    try {
      if (navigator.clipboard && typeof navigator.clipboard.write === 'function' && typeof ClipboardItem === 'function') {
        const htmlBlob = new Blob([state.clipboardHtml], { type: 'text/html' });
        const textBlob = new Blob([state.plainText], { type: 'text/plain' });
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': htmlBlob,
            'text/plain': textBlob
          })
        ]);
      } else {
        fallbackCopyRichHtml(state.renderedBodyHtml);
      }

      celebrateCopySuccess();
    } catch (err) {
      // Fallback for file:// or restricted permissions
      try {
        fallbackCopyRichHtml(state.renderedBodyHtml);
        celebrateCopySuccess();
      } catch (fallbackErr) {
        console.error('Copy failed:', err, fallbackErr);
        showToast('Copy failed. Try selecting the preview and pressing Cmd/Ctrl+C.', true);
      }
    }
  }

  function fallbackCopyRichHtml(htmlFragment) {
    const container = document.createElement('div');
    container.setAttribute('contenteditable', 'true');
    container.style.position = 'fixed';
    container.style.left = '-99999px';
    container.style.top = '0';
    container.style.opacity = '0';
    container.innerHTML = htmlFragment;
    document.body.appendChild(container);

    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(container);
    selection.removeAllRanges();
    selection.addRange(range);

    const ok = document.execCommand('copy');
    selection.removeAllRanges();
    document.body.removeChild(container);

    if (!ok) throw new Error('execCommand copy returned false');
  }

  function celebrateCopySuccess() {
    const targetName = PROFILES[state.target].name;
    const modeLabel = getMathModeShortLabel(state.mathMode);

    els.copyBtn.classList.add('copied');
    els.copyBtnLabel.textContent = 'Copied!';
    showToast(`Copied for ${targetName} (${modeLabel}). Paste with Cmd/Ctrl+V.`);

    clearTimeout(celebrateCopySuccess._timer);
    celebrateCopySuccess._timer = setTimeout(() => {
      els.copyBtn.classList.remove('copied');
      updateTargetUI();
    }, 1800);
  }

  function downloadWordDoc() {
    if (!state.renderedBodyHtml) {
      showToast('Nothing to download — paste some Markdown first.', true);
      return;
    }

    const docHtml =
      `<!DOCTYPE html>\n` +
      buildClipboardHtml(state.renderedBodyHtml, PROFILES.word, 'word');

    const blob = new Blob(['\ufeff', docHtml], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'document.doc';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('Downloaded document.doc for Microsoft Word.');
  }

  // ============================================================================
  // UI Rendering & State Sync
  // ============================================================================

  function getMathModeShortLabel(mode) {
    switch (mode) {
      case 'png': return 'PNG equations';
      case 'mathml': return 'native MathML equations';
      case 'unicode': return 'editable Unicode math';
      case 'latex': return 'raw LaTeX';
      default: return mode;
    }
  }

  function updateTargetUI() {
    const isWord = state.target === 'word';
    document.body.classList.toggle('mode-word', isWord);

    els.targetBtns.forEach((btn) => {
      const active = btn.dataset.target === state.target;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-checked', String(active));
    });

    els.mathModeSelect.value = state.mathMode;
    els.copyBtnLabel.textContent = isWord ? 'Copy for Microsoft Word' : 'Copy for Google Docs';
    els.downloadDocBtn.classList.toggle('hidden', !isWord);

    els.targetBadge.textContent = isWord ? 'Microsoft Word' : 'Google Docs';
    els.targetBadge.className = `badge ${isWord ? 'badge-word' : 'badge-gdocs'}`;

    // Update helpful hint banner
    let hintHtml = '';
    if (!isWord) {
      if (state.mathMode === 'png') {
        hintHtml = `<span class="info-dot"></span><span><strong>Google Docs mode:</strong> Inline CSS, boxed syntax-highlighted code, and <strong>3× Retina PNG equations</strong> for clean paste via <strong>Cmd/Ctrl+V</strong>.</span>`;
      } else if (state.mathMode === 'mathml') {
        hintHtml = `<span class="info-dot"></span><span><strong>Heads up:</strong> Google Docs does not natively import MathML on paste. Switch Math to <strong>Crisp PNG Image</strong> or <strong>Editable Unicode Text</strong> for best results.</span>`;
      } else if (state.mathMode === 'unicode') {
        hintHtml = `<span class="info-dot"></span><span><strong>Google Docs mode:</strong> Equations are converted to <strong>editable Unicode text + sup/sub</strong> so you can edit them directly in Docs.</span>`;
      } else {
        hintHtml = `<span class="info-dot"></span><span><strong>Google Docs mode:</strong> Keeps <strong>raw LaTeX ($...$ / $$...$$)</strong> for use with the Auto-LaTeX Equations add-on.</span>`;
      }
    } else {
      if (state.mathMode === 'mathml') {
        hintHtml = `<span class="info-dot"></span><span><strong>Microsoft Word mode:</strong> Uses Office XML formatting and <strong>native MathML</strong> — Word automatically converts equations into editable Word Equations on paste.</span>`;
      } else if (state.mathMode === 'png') {
        hintHtml = `<span class="info-dot"></span><span><strong>Microsoft Word mode:</strong> Uses Office styling with <strong>3× Retina PNG equations</strong> (ideal for Word Online or exact layout preservation).</span>`;
      } else if (state.mathMode === 'unicode') {
        hintHtml = `<span class="info-dot"></span><span><strong>Microsoft Word mode:</strong> Equations are formatted as <strong>editable Unicode text + sup/sub</strong> in Cambria Math.</span>`;
      } else {
        hintHtml = `<span class="info-dot"></span><span><strong>Microsoft Word mode:</strong> Preserves <strong>raw LaTeX</strong> alongside Word-native headings, tables, and code blocks.</span>`;
      }
    }
    els.targetHint.innerHTML = hintHtml;
  }

  function updateViewModeUI() {
    els.viewTabs.forEach((tab) => {
      const active = tab.dataset.view === state.viewMode;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
    });
    els.previewPaper.classList.toggle('hidden', state.viewMode !== 'rendered');
    els.htmlSource.classList.toggle('hidden', state.viewMode !== 'html');
  }

  function updateInputStats(md, counts) {
    const trimmed = md.trim();
    const words = trimmed ? trimmed.split(/\s+/).length : 0;
    const parts = [`${words} word${words === 1 ? '' : 's'}`];
    if (counts.tables > 0) parts.push(`${counts.tables} table${counts.tables === 1 ? '' : 's'}`);
    if (counts.equations > 0) parts.push(`${counts.equations} eq`);
    if (counts.codeBlocks > 0) parts.push(`${counts.codeBlocks} code`);
    if (counts.images > 0) parts.push(`${counts.images} img`);
    els.inputStats.textContent = parts.join(' · ');
  }

  let renderDebounceTimer = null;
  function scheduleRender(immediate = false) {
    clearTimeout(renderDebounceTimer);
    if (immediate) {
      runRender();
    } else {
      renderDebounceTimer = setTimeout(runRender, 140);
    }
  }

  async function runRender() {
    const version = ++state.renderVersion;
    const md = els.input.value;

    try {
      localStorage.setItem(STORAGE_KEY, md);
    } catch (_) {
      // Ignore storage quota / private mode errors
    }

    els.statusIndicator.textContent = 'Converting...';

    const result = await convertMarkdown(md, state.target, state.mathMode);
    if (version !== state.renderVersion) return; // Stale render

    state.renderedBodyHtml = result.bodyHtml;
    state.clipboardHtml = result.clipboardHtml;
    state.plainText = result.plainText;

    els.previewPaper.innerHTML = result.bodyHtml;
    els.htmlSource.textContent = result.clipboardHtml;
    updateInputStats(md, result.counts);
    els.statusIndicator.textContent = '';
  }

  function showToast(message, isError = false) {
    els.toast.textContent = message;
    els.toast.classList.toggle('toast-error', isError);
    els.toast.classList.add('visible');
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
      els.toast.classList.remove('visible');
    }, 2800);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ============================================================================
  // Event Listeners & Initialization
  // ============================================================================

  function bindEvents() {
    els.input.addEventListener('input', () => scheduleRender(false));

    // Target selector
    els.targetBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const nextTarget = btn.dataset.target;
        if (nextTarget === state.target) return;
        state.target = nextTarget;
        state.mathMode = DEFAULT_MATH_MODE[nextTarget];
        updateTargetUI();
        scheduleRender(true);
      });
    });

    // Math mode selector
    els.mathModeSelect.addEventListener('change', () => {
      state.mathMode = els.mathModeSelect.value;
      updateTargetUI();
      scheduleRender(true);
    });

    // View tabs (Document vs HTML source)
    els.viewTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        state.viewMode = tab.dataset.view;
        updateViewModeUI();
      });
    });

    // Copy & Download
    els.copyBtn.addEventListener('click', copyFormattedDocument);
    els.downloadDocBtn.addEventListener('click', downloadWordDoc);

    // Quick toolbar actions
    els.pasteBtn.addEventListener('click', async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (text) {
          els.input.value = text;
          scheduleRender(true);
          showToast('Pasted Markdown from clipboard.');
        } else {
          showToast('Clipboard is empty.', true);
        }
      } catch (_) {
        els.input.focus();
        showToast('Press Cmd/Ctrl+V inside the editor to paste.', false);
      }
    });

    els.sampleBtn.addEventListener('click', () => {
      els.input.value = SAMPLE_MARKDOWN;
      scheduleRender(true);
      showToast('Loaded sample document.');
    });

    els.clearBtn.addEventListener('click', () => {
      els.input.value = '';
      scheduleRender(true);
      els.input.focus();
    });

    // Keyboard shortcut: Cmd/Ctrl + Shift + C -> Copy formatted
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        copyFormattedDocument();
      }
    });

    // Drag & drop .md/.txt file into editor
    ['dragenter', 'dragover'].forEach((evt) => {
      els.dropZone.addEventListener(evt, (e) => {
        e.preventDefault();
        els.dropZone.classList.add('drag-over');
      });
    });

    ['dragleave', 'drop'].forEach((evt) => {
      els.dropZone.addEventListener(evt, (e) => {
        e.preventDefault();
        els.dropZone.classList.remove('drag-over');
      });
    });

    els.dropZone.addEventListener('drop', (e) => {
      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        els.input.value = String(reader.result || '');
        scheduleRender(true);
        showToast(`Loaded ${file.name}`);
      };
      reader.readAsText(file);
    });
  }

  function applyUrlParams() {
    try {
      const params = new URLSearchParams(window.location.search);
      const target = params.get('target');
      if (target === 'gdocs' || target === 'word') {
        state.target = target;
        state.mathMode = DEFAULT_MATH_MODE[target];
      }
      const math = params.get('math');
      if (['png', 'mathml', 'unicode', 'latex'].includes(math)) {
        state.mathMode = math;
      }
      const view = params.get('view');
      if (view === 'rendered' || view === 'html') {
        state.viewMode = view;
      }
      return params.get('sample') === '1';
    } catch (_) {
      return false;
    }
  }

  function init() {
    const forceSample = applyUrlParams();
    bindEvents();
    updateTargetUI();
    updateViewModeUI();

    let saved = null;
    if (!forceSample) {
      try {
        saved = localStorage.getItem(STORAGE_KEY);
      } catch (_) {
        saved = null;
      }
    }

    els.input.value = saved !== null ? saved : SAMPLE_MARKDOWN;
    scheduleRender(true);

    // Re-render once MathJax finishes async startup (in case initial render ran before MathJax loaded)
    if (window.MathJax && window.MathJax.startup && window.MathJax.startup.promise) {
      window.MathJax.startup.promise.then(() => {
        state.mathJaxReady = true;
        scheduleRender(true);
      }).catch(() => {});
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
