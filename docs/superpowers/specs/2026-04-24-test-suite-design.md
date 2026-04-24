# Test Suite Design

## Goal

Add a test suite to the the-art-of-toast project covering glass.js, liquid-renderer.js, and main.js using TDD (test-first).

## Architecture

```
tests/
  glass.test.js             — Glass class, DIFFICULTY_CONFIGS
  liquid-renderer.test.js   — WebGL shader, ParticleUploader, LiquidRenderer
  main.test.js              — Game logic, physics, DOM integration
```

### Dependencies

| Package | Purpose |
|---------|---------|
| `vitest` | Test runner (native Vite/ESM compatibility) |
| `jsdom` | DOM environment for main.js (innerWidth/innerHeight, document.getElementById) |
| `gl` (headless-gl) | Headless WebGL 1.0 context for liquid-renderer.js shader and rendering tests |

### Test Environment Setup

- **glass.js tests** — Need `innerWidth`/`innerHeight` globals (from jsdom or manually set). Matter.js engine setup for Glass construction.
- **liquid-renderer.js tests** — Need a WebGL context. A setup hook creates `<canvas id="webgl-canvas">` in jsdom, then `gl` wraps it with a headless WebGL context.
- **main.js tests** — Need full DOM (jsdom) with `#matter-canvas`, `#endgame`, `#foreground`, `#background`, glass elements, etc. Need Matter.js engine. Module-level side effects (FPS counter, difficulty button binding, resize listener) are skipped in test env via `import.meta.env` check.

### Test Scope by Module

**glass.js** (~8 tests):
- `DIFFICULTY_CONFIGS` has expected keys and color values in valid 0–1 range
- Glass constructor creates correct number of body parts (5)
- Mirrored glass flips left/right wall offsets
- `_makeTransform` returns CSS string with correct mirroring
- `updatePosition` clamps position to viewport bounds
- `getLowestCupLipPoint` returns max of two tip Y positions

**liquid-renderer.js** (~5 tests):
- Shader source strings compile successfully with headless WebGL context
- `ParticleUploader` creates uniform locations for all MAX_PARTICLES slots
- `LiquidRenderer` constructor initializes WebGL context, sets uniforms, enables blend
- `resize()` updates canvas dimensions and viewport
- `destroy()` triggers WebGL context loss
- `render()` clears and draws a full-screen quad

**main.js** (~6 tests):
- `createLiquid` adds correct number of particles to target array
- `cupsCollide` returns true when cup parts overlap, false when separated
- `triggerEndGame` sets endgame DOM text and display
- `randomNumBetween` returns values within [min, max]
- Resize handler updates render canvas dimensions
- Game restart cleanup stops old Matter.js runner/engine/render

## Out of Scope

- E2E/browser tests (Playwright/WebDriver)
- Visual regression tests for shader output
- Touch control event simulation
- FPS counter testing

## Testing Strategy

TDD (Red-Green-Refactor): write failing test → implement fix → verify pass → refactor. Each module's tests are written before any code changes to that module.

No production code changes expected — tests verify existing behavior. If a test reveals a bug, the bug is fixed via the TDD cycle.
