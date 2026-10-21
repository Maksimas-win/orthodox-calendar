# Project instructions

## Cross artwork — user decision, 2026-10-21

For parish-related website interface artwork, use the approved decorative four-ended cross with one main horizontal crossbar and trefoil ends. Do not add a lower crossbar, slanted footrest, or a second short upper crossbar. The user explicitly requested: «Делай кресты без нижней перекладины», «просто красивые Кресты»; the two supplied references show the single-horizontal-bar silhouette.

Reuse the project's canonical SVG geometry for headers, footers, decorative interface symbols, favicons, PWA/application icons, and any new promotional artwork. Preserve each site's colors and appropriate sizing. Use SVG rather than the Unicode Orthodox-cross glyph (`☦`, U+2626), whose extra crossbars cannot be controlled. Never mirror, rotate, or add bars to the approved cross.

This rule applies to designed interface artwork. Preserve original photographs, historical illustrations, icons, and quoted/archive content. Do not introduce cross symbols into a project whose existing design policy excludes religious symbols.

Keep this decision in the project's AGENTS.md so future changes retain the approved form. If the SVG is used by a favicon or installation icon, update its versioned references and relevant service-worker caches when its appearance changes.

`cross-v1.svg`, inline SVG artwork in `index.html`, and `favicon-cross-v1.svg` use this geometry.

### Approved SVG geometry

Preserve this exact path and `viewBox="0 0 64 96"`. Use `preserveAspectRatio="xMidYMid meet"` or an equivalent uniform scale; colors may follow the site palette.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 96" fill="currentColor">
  <path d="M32 1a6 6 0 0 1 6 6v1.1a6 6 0 1 1-1 11.6V30h7.3a6 6 0 1 1 11.6-1H57a6 6 0 0 1 0 12h-1.1a6 6 0 1 1-11.6-1H37v36.3a6 6 0 1 1 1 11.6V89a6 6 0 0 1-12 0v-1.1a6 6 0 1 1 1-11.6V40h-7.3a6 6 0 1 1-11.6 1H7a6 6 0 0 1 0-12h1.1a6 6 0 1 1 11.6 1H27V19.7a6 6 0 1 1-1-11.6V7a6 6 0 0 1 6-6Z"/>
</svg>
```
