# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # start dev server (with --host for LAN access)
npm run build    # build to dist/
npm run preview  # preview the production build
```

No test suite. No linter configured.

## Architecture

A two-player browser physics game ("toast simulator") built with **Matter.js** for physics and **Vite** for bundling. No framework — plain ES modules.

**Entry points:**
- [index.html](index.html) — all markup and inline SVG assets (glass image is an inline SVG)
- [main.js](main.js) — game loop, input binding, end-game logic
- [glass.js](glass.js) — `Glass` class and `DIFFICULTY_CONFIGS`
- [style.css](style.css) — all styling including touch control layout

**Physics layer ([main.js](main.js)):**
- `init()` creates the Matter.js `Engine`, `Render` (canvas), and `Runner`
- Liquid is represented as an array of `Bodies.circle` particles (`circles0` / `circles1`)
- On each `runner` tick: off-screen particles are removed; empty-cup and cup-collision win conditions are checked; then `glass.updatePosition()` is called to apply queued control inputs

**Glass class ([glass.js](glass.js)):**
- Each cup is a static compound `Body` with three rectangle parts (left wall, right wall, bottom) plus two invisible `leftTip`/`rightTip` circle bodies that track the cup-lip position for win-condition comparisons
- `mirrored=true` (glass1/right player) flips offsets and applies `scaleX(-1)` to the CSS image so both cups face each other
- `xCorrection` compensates for the visual center vs. the physics centroid of the asymmetric compound body
- `_makeTransform` computes the CSS `transform` string to sync the `<img>` overlay with the physics body; it reads live `innerWidth`/`innerHeight` so resize works without storing stale dimensions
- `updatePosition()` reads `this.control` flags set by keyboard/touch listeners and moves/rotates the static body each tick

**Touch controls ([main.js:198](main.js#L198), [index.html](index.html)):**
- P1's control strip is rotated 180° in CSS so two players can hold the phone face-to-face; arrow labels and `data-action` values are intentionally swapped to compensate
- Touch controls are only shown/wired when `'ontouchstart' in window`

**Visual liquid effect:**
- The Matter.js canvas is rendered behind an SVG `<feGaussianBlur>` + `<feColorMatrix>` ("gooey") filter applied to a foreground `<div>`, creating a metaball effect on the particles
- `stdDeviation` and `colorMatrix` values switch at 600px viewport width for mobile

**Deployment:** GitHub Pages via workflow; `vite.config.js` sets `base: '/the-art-of-toast/'`.
