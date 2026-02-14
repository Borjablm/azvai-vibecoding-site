# AZVAI Site – AI Instructions

- **Stack**: Astro 5.2 + SSR via @astrojs/netlify, vanilla JS in `<script>` tags, CSS custom properties in `src/styles/global.css`
- **Deploy**: Netlify (auto-deploys on push to `master`), live at ai.azvai.com
- **Repo**: `https://github.com/Borjablm/azvai-vibecoding-site.git`
- **API**: Lumination API — env vars `LUMINATION_API_BASE_URL`, `LUMINATION_API_KEY` (set in Netlify)

## Project structure

```
src/
  layouts/BaseLayout.astro        # Shared shell (nav, footer, global CSS)
  styles/global.css               # All styles — design tokens, components, utilities
  pages/
    api/training/*.ts             # Server-side API routes (SSR, not prerendered)
    training/*.astro              # Training tool pages
    projects/*.astro              # Portfolio project pages
```

## Key conventions

See [docs/patterns.md](docs/patterns.md) for detailed frontend patterns (rendering, LaTeX, wizards, uploads).

- **CSS**: Single `global.css` file, no CSS modules. Use existing custom properties (`--brand`, `--text`, `--surface`, etc.)
- **Specificity**: Watch `.sim-panel button` — scoped with `:not(.option-button):not(.btn-secondary)` to avoid overriding child button styles
- **API routes**: All use `export const prerender = false;` and return `jsonResponse()`. Lumination response body nests text at `response.response` — use `extractAssistantText()` to unwrap
- **No frameworks**: All interactivity is vanilla JS in `<script>` tags — no React/Vue/Svelte
