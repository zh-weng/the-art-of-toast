# WebGL Metaball Liquid Renderer

## Problem

Safari falls back to CPU software rendering when an SVG filter is applied directly to a `<canvas>` element. The existing gooey metaball effect uses `filter: url(#gooey)` on the Matter.js canvas, causing severe frame rate degradation on Safari.

## Goal

Replace the SVG gooey filter with a WebGL fragment shader that renders the metaball liquid effect entirely on the GPU. Visually equivalent to the current effect. Liquid color varies by difficulty.

## Architecture

### New file: `liquid-renderer.js`

Encapsulates all WebGL logic. `main.js` calls `liquidRenderer.render(circles0, circles1)` each tick and knows nothing about WebGL internals.

Internal structure:

- **`ParticleUploader`** — abstraction for sending particle positions to the GPU. Phase A: uniform array. Phase B (future): float texture. Swappable without touching shader or renderer.
- **`MetaballShader`** — compiles and owns the WebGL program. Fragment shader iterates over all particles, accumulates the metaball field, and colors pixels that exceed the threshold.
- **`LiquidRenderer`** — assembles the above, owns the WebGL canvas, exposes `render(circles0, circles1)` and `resize()`.

### New element: `<canvas id="webgl-canvas">`

Layered on top of the Matter.js canvas via `position: absolute`. Handles all visual output. `pointer-events: none`.

The Matter.js canvas is kept (physics still runs on it) but hidden (`opacity: 0`).

## Shader Design

Fragment shader per-pixel metaball field:

```glsl
float field = 0.0;
for (int i = 0; i < MAX_PARTICLES; i++) {
    vec2 delta = uParticles[i] - fragCoord;
    field += uRadius * uRadius / dot(delta, delta);
}
if (field > uThreshold) gl_FragColor = uColor;
else discard;
```

- `MAX_PARTICLES = 128` (compile-time constant; covers easy=120, normal=100, hard=80)
- `uRadius` and `uThreshold` are tunable uniforms to match the visual feel of the current gooey filter
- Phase B upgrade: replace `uParticles` uniform array with a `sampler2D` texture read; shader and renderer interface unchanged

## Liquid Colors by Difficulty

| Difficulty | Liquid  | Color                      |
|------------|---------|----------------------------|
| easy       | 啤酒    | `rgba(240, 180, 40, 0.85)` |
| normal     | 红酒    | `rgba(120, 20, 40, 0.85)`  |
| hard       | 白酒    | `rgba(220, 235, 255, 0.75)`|

Color passed as a constructor argument to `LiquidRenderer`. `main.js` selects color from `DIFFICULTY_CONFIGS`.

## Changes to Existing Files

### `main.js`
- `init()`: set Matter.js render background to transparent
- `startGame(config)`: construct `LiquidRenderer` with color from config; call `liquidRenderer.resize()` on window resize
- `tick` handler: add `liquidRenderer.render(circles0, circles1)`
- Delete `resizeFilter()` and all calls to it

### `index.html`
- Delete `<svg>` block containing `<filter id="gooey">`
- Add `<canvas id="webgl-canvas">` after `<canvas id="matter-canvas">`

### `style.css`
- Remove `filter: url(#gooey)` from `#matter-canvas`
- Add `#webgl-canvas`: `position: absolute`, full viewport size, `pointer-events: none`, `z-index` above matter-canvas
- Set `#matter-canvas` to `opacity: 0`

### `glass.js`
- No changes.

## Out of Scope

- Foam/bubble effects
- Per-player different colors
- Physics changes per liquid type
