# Frontend Patterns

Lessons learned from building the training tools. Reference this when creating new tools.

## LaTeX / Formula Rendering

**Applies to**: Any tool that renders free-form AI prose (currently only `ai-coach-chatbot`). Tools that display structured JSON fields (quiz questions, simulator scenarios) don't need this.

**Problem**: The markdown parser (`marked`) strips backslashes from LaTeX before MathJax can process it, turning `$\frac{1}{2}$` into `$frac12$`.

**Solution** (implemented in `ai-coach-chatbot.astro`):

1. **Protect → Parse → Restore**: Before markdown parsing, replace all LaTeX blocks with text placeholders (`XLATEXBLOCK0XLATEXEND`). Parse markdown + sanitize with DOMPurify. Then restore the original LaTeX strings. MathJax typesets last.

2. **Use CHTML renderer**, not SVG. SVG produces oversized output. Load `tex-chtml.js` from the MathJax CDN.

3. **No overflow rules on the chat bubble** (`.chat-message-content`). Setting `overflow-x: auto` triggers CSS to also set `overflow-y: auto`, causing scrollbars and vertical clipping on formulas. Let content flow naturally.

4. **Delimiter config**: Enable both `$`/`$$` and `\(...\)`/`\[...\]` in MathJax config so formulas render regardless of which delimiter the LLM uses.

**If adding formula support to a new tool**, copy these functions from `ai-coach-chatbot.astro`:
- `getMarkdownLibs()` — lazy-loads `marked` + `DOMPurify` from CDN
- `ensureMathJax()` — lazy-loads MathJax 3 CHTML
- `protectLatex()` / `restoreLatex()` — placeholder swap
- `renderAssistantContent(container, markdownText)` — orchestrates the full pipeline

## Wizard / Multi-Step Flow

All training tools use a step wizard pattern:
- `.wizard-progress` bar with numbered dots and connecting lines
- `.wizard-step` divs toggled via `goToStep(n)` — only one visible at a time
- Steps use `.active` / `.done` classes for styling
- Back buttons use `data-back` attribute for generic handler

## Drag-and-Drop Uploads

Reusable pattern with `.drop-zone` + hidden `<input type="file">`:
- `setupDropZone(zone, input, onFiles)` — handles drag events, click-to-browse, and file change
- `.drop-zone.drag-over` for hover highlight, `.drop-zone.has-file` for loaded state
- PDF text extraction via `pdfjs-dist` (CDN), OCR via `tesseract.js` (CDN)

## Rendering AI Responses

- **Free-form prose** (chatbot): Use `renderAssistantContent()` — markdown → sanitize → MathJax
- **Structured JSON** (quiz, simulator): Parse JSON, use `textContent` for plain text fields, `escapeHtml()` for fields injected via `innerHTML`
- **JSON unwrapping**: Lumination API sometimes double-wraps responses. Use `unwrapResult()` to handle stringified JSON and `result.result` nesting

## CSS Gotchas

- **Heading sizes in chat**: Global `h1`/`h2`/`h3` use `clamp()` for large display. Override with fixed `font-size` inside `.chat-message-content`
- **Button specificity**: `.sim-panel button` sets white text. Scope it with `:not(.option-button):not(.btn-secondary)` so quiz/option buttons keep their own colors
- **Contrast**: Option buttons use `--brand-mid` background with dark text, not `--brand` (too light)
