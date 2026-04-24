# Test Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add unit and integration tests for glass.js, liquid-renderer.js, and main.js using Vitest with jsdom and headless-gl.

**Architecture:** Three test files in `tests/` — one per source module. Vitest runs in jsdom environment for DOM globals. liquid-renderer.js tests use headless-gl (`gl`) for a real WebGL 1.0 context. main.js tests require adding `export` keywords to internal functions (minimal, no behavior change).

**Tech Stack:** Vitest, jsdom, gl (headless-gl), Matter.js (existing)

---

### Task 0: Install test dependencies and configure Vitest

**Files:**
- Modify: `package.json`
- Create: `vitest.config.js`
- Create: `tests/vitest.setup.js`

- [ ] **Step 1: Install dependencies**

```bash
npm install --save-dev vitest jsdom gl
```

Expected: all three packages install. `gl` may compile native bindings (macOS uses system OpenGL framework).

- [ ] **Step 2: Add test script to package.json**

In `package.json`, after `"preview": "vite preview"`, add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Create vitest.config.js**

```js
import {defineConfig} from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/vitest.setup.js']
  }
})
```

- [ ] **Step 4: Create tests/vitest.setup.js**

```js
import {JSDOM} from 'jsdom'

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost',
  pretendToBeVisual: true
})

globalThis.window = dom.window
globalThis.document = dom.window.document
globalThis.innerWidth = 800
globalThis.innerHeight = 600
globalThis.navigator = dom.window.navigator
globalThis.HTMLCanvasElement = dom.window.HTMLCanvasElement
```

- [ ] **Step 5: Verify vitest runs (zero tests)**

```bash
npx vitest run
```

Expected: "No test files found" or exit code 0.

- [ ] **Step 6: Commit**

```bash
git add package.json vitest.config.js tests/vitest.setup.js
git commit -m "chore: add vitest, jsdom, and headless-gl test infrastructure"
```

---

### Task 1: glass.js unit tests

**Files:**
- Create: `tests/glass.test.js`

- [ ] **Step 1: Write DIFFICULTY_CONFIGS tests**

Create `tests/glass.test.js`:

```js
import {describe, it, expect} from 'vitest'
import {DIFFICULTY_CONFIGS} from '../glass.js'

describe('DIFFICULTY_CONFIGS', () => {
  it('has easy, normal, and hard keys in order', () => {
    expect(Object.keys(DIFFICULTY_CONFIGS)).toEqual(['easy', 'normal', 'hard'])
  })

  it('color values are in valid 0–1 range for every difficulty', () => {
    for (const key of Object.keys(DIFFICULTY_CONFIGS)) {
      const [r, g, b, a] = DIFFICULTY_CONFIGS[key].color
      for (const ch of [r, g, b, a]) {
        expect(ch).toBeGreaterThanOrEqual(0)
        expect(ch).toBeLessThanOrEqual(1)
      }
    }
  })

  it('every difficulty has wallAngleDeg and particles as positive numbers', () => {
    for (const cfg of Object.values(DIFFICULTY_CONFIGS)) {
      expect(typeof cfg.wallAngleDeg).toBe('number')
      expect(cfg.wallAngleDeg).toBeGreaterThan(0)
      expect(typeof cfg.particles).toBe('number')
      expect(cfg.particles).toBeGreaterThan(0)
    }
  })
})
```

- [ ] **Step 2: Run config tests to verify they pass**

```bash
npx vitest run tests/glass.test.js
```

Expected: 3 tests pass.

- [ ] **Step 3: Add Glass class geometry and behavior tests**

Append to `tests/glass.test.js`:

```js
import {Bodies, Body, Composite, Engine} from 'matter-js'
import {Glass} from '../glass.js'

describe('Glass', () => {
  let engine

  beforeEach(() => {
    globalThis.innerWidth = 800
    globalThis.innerHeight = 600
    engine = Engine.create()
  })

  function makeImg(id) {
    const existing = document.getElementById(id)
    if (existing) existing.remove()
    const img = document.createElement('img')
    img.id = id
    img.style = {}
    document.body.appendChild(img)
    return img
  }

  it('creates a compound body with 5 parts (left, right, bottom, leftTip, rightTip)', () => {
    const g = new Glass({x: 400, y: 300}, engine, makeImg('glass0'), false, DIFFICULTY_CONFIGS.normal)
    expect(g.glass.parts.length).toBe(5)
    expect(g.leftTip).toBeDefined()
    expect(g.rightTip).toBeDefined()
  })

  it('mirrored glass has xCorrection = -11, non-mirrored has xCorrection = 11', () => {
    const mirrored = new Glass({x: 400, y: 300}, engine, makeImg('mirrored'), true, DIFFICULTY_CONFIGS.normal)
    const normal   = new Glass({x: 400, y: 300}, engine, makeImg('normal'), false, DIFFICULTY_CONFIGS.normal)
    expect(mirrored.xCorrection).toBe(-11)
    expect(normal.xCorrection).toBe(11)
  })

  it('_makeTransform includes scaleX(-1) for mirrored cups', () => {
    const g = new Glass({x: 400, y: 300}, engine, makeImg('glass-m'), true, DIFFICULTY_CONFIGS.normal)
    const t = g._makeTransform(400, 300, 0)
    expect(t).toContain('scaleX(-1)')
  })

  it('_makeTransform does NOT include scaleX(-1) for non-mirrored cups', () => {
    const g = new Glass({x: 400, y: 300}, engine, makeImg('glass-n'), false, DIFFICULTY_CONFIGS.normal)
    const t = g._makeTransform(400, 300, 0)
    expect(t).not.toContain('scaleX(-1)')
  })

  it('updatePosition clamps x to [0, innerWidth]', () => {
    const g = new Glass({x: 400, y: 300}, engine, makeImg('glass-clamp'), false, DIFFICULTY_CONFIGS.normal)

    g.control.left = true
    for (let i = 0; i < 200; i++) g.updatePosition()
    expect(g.getPosition().x).toBeGreaterThanOrEqual(0)

    g.control.left = false
    g.control.right = true
    for (let i = 0; i < 200; i++) g.updatePosition()
    expect(g.getPosition().x).toBeLessThanOrEqual(innerWidth)
  })

  it('updatePosition clamps y to [0, innerHeight-20]', () => {
    const g = new Glass({x: 400, y: 300}, engine, makeImg('glass-cy'), false, DIFFICULTY_CONFIGS.normal)

    g.control.up = true
    for (let i = 0; i < 200; i++) g.updatePosition()
    expect(g.getPosition().y).toBeGreaterThanOrEqual(0)

    g.control.up = false
    g.control.down = true
    for (let i = 0; i < 200; i++) g.updatePosition()
    expect(g.getPosition().y).toBeLessThanOrEqual(innerHeight - 20)
  })

  it('getLowestCupLipPoint returns the max Y of leftTip and rightTip', () => {
    const g = new Glass({x: 400, y: 300}, engine, makeImg('glass-lip'), false, DIFFICULTY_CONFIGS.normal)
    const lipY = g.getLowestCupLipPoint()
    expect(lipY).toBe(Math.max(g.leftTip.position.y, g.rightTip.position.y))
  })
})
```

- [ ] **Step 4: Run all glass tests**

```bash
npx vitest run tests/glass.test.js
```

Expected: 10 tests pass.

- [ ] **Step 5: Commit**

```bash
git add tests/glass.test.js
git commit -m "test: add glass.js unit tests for configs, geometry, transforms, and clamping"
```

---

### Task 2: liquid-renderer.js WebGL integration tests

**Files:**
- Create: `tests/liquid-renderer.test.js`
- Modify: `tests/vitest.setup.js`

- [ ] **Step 1: Update vitest.setup.js to inject headless WebGL context**

Replace `tests/vitest.setup.js` completely:

```js
import {JSDOM} from 'jsdom'
import createContext from 'gl'

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost',
  pretendToBeVisual: true
})

globalThis.window = dom.window
globalThis.document = dom.window.document
globalThis.innerWidth = 800
globalThis.innerHeight = 600
globalThis.navigator = dom.window.navigator
globalThis.HTMLCanvasElement = dom.window.HTMLCanvasElement

// Patch canvas getContext so 'webgl' returns a headless-gl context
const OrigCanvas = dom.window.HTMLCanvasElement
dom.window.HTMLCanvasElement.prototype.getContext = function (type, attrs) {
  if (type === 'webgl') {
    const ctx = createContext(800, 600, {preserveDrawingBuffer: true, alpha: true})
    ctx.canvas = this
    return ctx
  }
  return OrigCanvas.prototype.getContext.call(this, type, attrs)
}
```

- [ ] **Step 2: Write liquid-renderer.js tests**

Create `tests/liquid-renderer.test.js`:

```js
import {describe, it, expect, beforeEach} from 'vitest'

describe('LiquidRenderer', () => {
  beforeEach(() => {
    const existing = document.getElementById('webgl-canvas')
    if (existing) existing.remove()
    const canvas = document.createElement('canvas')
    canvas.id = 'webgl-canvas'
    document.body.appendChild(canvas)
    globalThis.innerWidth = 800
    globalThis.innerHeight = 600
  })

  it('constructor initializes without throwing for valid color', () => {
    const {LiquidRenderer} = requireLiquidRenderer()
    expect(() => new LiquidRenderer([1, 0, 0, 1])).not.toThrow()
  })

  it('creates a non-lost WebGL context', () => {
    const {LiquidRenderer} = requireLiquidRenderer()
    const lr = new LiquidRenderer([1, 0, 0, 1])
    expect(lr.gl).toBeDefined()
    expect(lr.gl.isContextLost()).toBe(false)
  })

  it('resize updates canvas dimensions to match innerWidth/innerHeight', () => {
    const {LiquidRenderer} = requireLiquidRenderer()
    const lr = new LiquidRenderer([1, 0, 0, 1])
    globalThis.innerWidth = 1024
    globalThis.innerHeight = 768
    lr.resize()
    expect(lr.canvas.width).toBe(1024)
    expect(lr.canvas.height).toBe(768)
  })

  it('destroy triggers WebGL context loss via WEBGL_lose_context', () => {
    const {LiquidRenderer} = requireLiquidRenderer()
    const lr = new LiquidRenderer([1, 0, 0, 1])
    lr.destroy()
    expect(lr.gl.isContextLost()).toBe(true)
  })

  it('render with particles clears and draws without throwing', () => {
    const {LiquidRenderer} = requireLiquidRenderer()
    const lr = new LiquidRenderer([1, 0, 0, 1])
    const circles0 = [{position: {x: 100, y: 100}}]
    const circles1 = [{position: {x: 200, y: 200}}]
    expect(() => lr.render(circles0, circles1)).not.toThrow()
  })

  it('render with empty particle arrays does not throw', () => {
    const {LiquidRenderer} = requireLiquidRenderer()
    const lr = new LiquidRenderer([1, 0, 0, 1])
    expect(() => lr.render([], [])).not.toThrow()
  })

  it('_renderScale defaults to 1.0 with headless-gl (non-Apple renderer)', () => {
    const {LiquidRenderer} = requireLiquidRenderer()
    const lr = new LiquidRenderer([1, 0, 0, 1])
    expect(lr._renderScale).toBe(1.0)
  })
})

// Dynamic require to ensure getContext patch is in place before module loads
function requireLiquidRenderer() {
  const Module = require('module')
  const m = new Module('')
  m._compile(`export {LiquidRenderer} from '${process.cwd()}/liquid-renderer.js'`, '')
  return m.exports
}
```

- [ ] **Step 3: Run liquid-renderer tests**

```bash
npx vitest run tests/liquid-renderer.test.js
```

Expected: 7 tests pass. If `gl` native bindings fail, install system deps (macOS: no extra deps needed).

- [ ] **Step 4: Commit**

```bash
git add tests/liquid-renderer.test.js tests/vitest.setup.js
git commit -m "test: add liquid-renderer.js WebGL integration tests"
```

---

### Task 3: main.js game logic integration tests

**Files:**
- Create: `tests/main.test.js`
- Modify: `main.js` (add `export` keywords only)
- Modify: `tests/vitest.setup.js`

- [ ] **Step 1: Add required DOM elements to vitest.setup.js**

Append to `tests/vitest.setup.js`:

```js
// DOM elements needed by main.js
function ensureEl(tag, id) {
  if (!document.getElementById(id)) {
    const el = document.createElement(tag)
    el.id = id
    document.body.appendChild(el)
  }
  return document.getElementById(id)
}
ensureEl('canvas', 'matter-canvas')
ensureEl('div', 'endgame')
ensureEl('div', 'endgame-reason')
ensureEl('div', 'foreground')
ensureEl('div', 'background')
ensureEl('div', 'touch-controls')
for (const id of ['glass0', 'glass1']) {
  if (!document.getElementById(id)) {
    const img = document.createElement('img')
    img.id = id
    img.style = {}
    document.body.appendChild(img)
  }
}
```

- [ ] **Step 2: Add exports to main.js functions**

In `main.js`, add `export` before these function declarations:

Line 32: Change `function clear() {` to `export function clear() {`
Line 39: Change `function init() {` to `export function init() {`
Line 63: Change `function createLiquid(pos, num, targetArray) {` to `export function createLiquid(pos, num, targetArray) {`
Line 80: Change `function cupsCollide() {` to `export function cupsCollide() {`
Line 91: Change `function triggerEndGame(winner, reason) {` to `export function triggerEndGame(winner, reason) {`
Line 116: Change `function startGame(config) {` to `export function startGame(config) {`
Line 214: Change `function setupTouchControls() {` to `export function setupTouchControls() {`
Line 235: Change `function randomNumBetween(min, max) {` to `export function randomNumBetween(min, max) {`

Also change `let engine, render, runner, mouse` to `export let engine, render, runner, mouse`
Also change `let glass0, glass1` to `export let glass0, glass1`
Also change `let gameOver = false` to `export let gameOver = false`

(These are additive — no behavior change.)

- [ ] **Step 3: Mock @rwh/keystrokes at the top of main.js import in tests**

The `@rwh/keystrokes` import has module-level side effects. In vitest.setup.js, add:

```js
import {vi} from 'vitest'
vi.mock('@rwh/keystrokes', () => ({
  bindKey: vi.fn(),
  unbindKey: vi.fn()
}))
```

Or add this at the top of the test file before importing main.js. Actually, `vi.mock` must be called before imports in vitest. Add it to vitest.setup.js:

```js
// vitest.setup.js — append at end
import {vi} from 'vitest'
vi.mock('@rwh/keystrokes', () => ({
  bindKey: vi.fn(),
  unbindKey: vi.fn()
}))
```

Wait — `vi.mock` is only available inside test files or setup files that run in the vitest context. Since `vitest.setup.js` is a setup file, `vi` should be available (because `globals: true` is in config).

Let me revise — keep it simple: mock in the setup file.

- [ ] **Step 3 (revised): Add keystrokes mock to vitest.setup.js**

Append to the end of `tests/vitest.setup.js`:

```js
// mustUseImport — in vitest.setup.js we can't use vi.mock with ESM hoisting.
// Instead, we'll mock in tests/main.test.js using vi.mock before import.
```

Actually, `vi.mock` hoists in vitest. So in the test file we can write:

```js
import {vi, describe, it, expect, beforeEach} from 'vitest'

vi.mock('@rwh/keystrokes', () => ({
  bindKey: vi.fn(),
  unbindKey: vi.fn()
}))

import {createLiquid, cupsCollide, triggerEndGame, randomNumBetween, clear, engine, render, runner, glass0, glass1, gameOver} from '../main.js'
```

This should work because `vi.mock` hoists before imports.

- [ ] **Step 4: Write main.js tests**

Create `tests/main.test.js`:

```js
import {vi, describe, it, expect, beforeEach} from 'vitest'
import {Bodies, Composite, Engine, Render, Runner} from 'matter-js'
import {Glass, DIFFICULTY_CONFIGS} from '../glass.js'

vi.mock('@rwh/keystrokes', () => ({
  bindKey: vi.fn(),
  unbindKey: vi.fn()
}))

import {
  createLiquid,
  cupsCollide,
  triggerEndGame,
  randomNumBetween,
  clear,
  engine,
  render,
  runner,
  glass0,
  glass1,
  gameOver,
  init
} from '../main.js'

describe('createLiquid', () => {
  let eng

  beforeEach(() => {
    globalThis.innerWidth = 800
    globalThis.innerHeight = 600
    eng = Engine.create()
  })

  it('creates the specified number of particles in the target array', () => {
    const circles = []
    createLiquid({x: 400, y: 300}, 10, circles, eng)
    expect(circles.length).toBe(10)
  })

  it('particle radius is between 6 and 7', () => {
    const circles = []
    createLiquid({x: 400, y: 300}, 20, circles, eng)
    for (const c of circles) {
      expect(c.circleRadius).toBeGreaterThanOrEqual(6)
      expect(c.circleRadius).toBeLessThanOrEqual(7)
    }
  })

  it('adds particles to the engine world', () => {
    const before = Composite.allBodies(eng.world).length
    const circles = []
    createLiquid({x: 400, y: 300}, 5, circles, eng)
    expect(Composite.allBodies(eng.world).length).toBe(before + 5)
  })
})

describe('cupsCollide', () => {
  let eng, g0, g1

  beforeEach(() => {
    globalThis.innerWidth = 800
    globalThis.innerHeight = 600
    eng = Engine.create()
    g0 = new Glass({x: 200, y: 400}, eng, makeImg('glass0'), true, DIFFICULTY_CONFIGS.normal)
    g1 = new Glass({x: 600, y: 400}, eng, makeImg('glass1'), false, DIFFICULTY_CONFIGS.normal)
  })

  function makeImg(id) {
    const existing = document.getElementById(id)
    if (existing) existing.remove()
    const img = document.createElement('img')
    img.id = id
    img.style = {}
    document.body.appendChild(img)
    return img
  }

  it('returns false when cups are far apart', () => {
    // cupsCollide reads module-level glass0/glass1 — set them
    Object.assign(globalThis, {glass0: g0, glass1: g1})
    expect(cupsCollide()).toBe(false)
  })

  it('returns true when cups overlap', () => {
    // Move glass1 close to glass0
    const {Body} = require('matter-js')
    Body.setPosition(g1.glass, {x: 250, y: 400})
    Object.assign(globalThis, {glass0: g0, glass1: g1})
    expect(cupsCollide()).toBe(true)
  })
})

describe('triggerEndGame', () => {
  beforeEach(() => {
    globalThis.gameOver = false
    document.getElementById('endgame').textContent = ''
    document.getElementById('endgame-reason').textContent = ''
    document.getElementById('foreground').style.display = 'none'
    document.getElementById('foreground').style.animation = ''
    document.getElementById('background').style.display = 'none'
    document.getElementById('background').style.animation = ''

    // Mock @rwh/keystrokes is already done at module level
  })

  // Note: triggerEndGame calls unbindKey and accesses glass0/glass1.control
  // We need to set up dummy glass objects.
  function setupGlasses() {
    const eng = Engine.create()
    const g0 = new Glass({x: 200, y: 500}, eng, makeImg('glass0'), true, DIFFICULTY_CONFIGS.normal)
    const g1 = new Glass({x: 600, y: 500}, eng, makeImg('glass1'), false, DIFFICULTY_CONFIGS.normal)
    return {g0, g1}
  }

  function makeImg(id) {
    const existing = document.getElementById(id)
    if (existing) existing.remove()
    const img = document.createElement('img')
    img.id = id
    img.style = {}
    document.body.appendChild(img)
    return img
  }

  it('sets endgame DOM text for left winner', () => {
    globalThis.gameOver = false
    Object.assign(globalThis, setupGlasses())
    triggerEndGame('left', '右方杯干')
    expect(document.getElementById('endgame').textContent).toBe('左方胜利！')
    expect(document.getElementById('endgame-reason').textContent).toBe('右方杯干')
    expect(document.getElementById('foreground').style.display).toBe('flex')
    expect(document.getElementById('background').style.display).toBe('flex')
  })

  it('sets endgame DOM text for right winner', () => {
    globalThis.gameOver = false
    Object.assign(globalThis, setupGlasses())
    triggerEndGame('right', '左方杯干')
    expect(document.getElementById('endgame').textContent).toBe('右方胜利！')
    expect(document.getElementById('endgame-reason').textContent).toBe('左方杯干')
  })

  it('is idempotent — second call does not overwrite first', () => {
    globalThis.gameOver = false
    Object.assign(globalThis, setupGlasses())
    triggerEndGame('left', 'reason1')
    const textAfterFirst = document.getElementById('endgame').textContent
    globalThis.gameOver = true
    triggerEndGame('right', 'reason2')
    expect(document.getElementById('endgame').textContent).toBe(textAfterFirst)
  })
})

describe('randomNumBetween', () => {
  it('returns values within [min, max] over 100 iterations', () => {
    for (let i = 0; i < 100; i++) {
      const v = randomNumBetween(6, 7)
      expect(v).toBeGreaterThanOrEqual(6)
      expect(v).toBeLessThanOrEqual(7)
    }
  })
})

describe('clear', () => {
  it('stops and nulls engine, render, and runner', async () => {
    const eng = Engine.create()
    const ren = Render.create({
      canvas: document.getElementById('matter-canvas'),
      engine: eng,
      options: {width: 800, height: 600, wireframes: false}
    })
    const run = Runner.create()
    Render.run(ren)
    Runner.run(run, eng)

    // Set module-level globals that clear() operates on
    Object.assign(globalThis, {engine: eng, render: ren, runner: run})

    clear()

    expect(globalThis.engine).toBeNull()
    expect(globalThis.render).toBeNull()
    expect(globalThis.runner).toBeNull()
  })
})
```

Hmm, this approach has issues. `glass0` and `glass1` are module-scoped `let` variables in main.js. Setting `globalThis.glass0` won't affect the module's closure. I need to export them and import them in the test.

But wait — I already said to export them in Step 2 (`export let glass0, glass1`). So in the test I can import them and reassign:

```js
import {glass0, glass1, cupsCollide} from '../main.js'
// Then in the test:
Object.assign(globalThis, {glass0: g0, glass1: g1})
```

Hmm, but imported bindings in ES modules are live bindings. If I import `glass0`, I get a binding to the module's `glass0`. Can I change it from the test? With `export let`, the import is a live binding — I can't reassign it from the consumer side.

Alternative: Export setter functions. Or: Test cupsCollide by importing it but have it use its own internal references... but those are the module's glass0/glass1.

The cleanest approach: In the test, I need to modify the main.js module's internal state. With ESM, this is not directly possible from outside.

Options:
1. Add setter functions to main.js (e.g., `export function setGlass0(g) { glass0 = g }`)
2. Test cupsCollide by inlining its logic (duplicate the function)
3. Use vitest's `vi.hoisted` to inject mocks at module evaluation time

I think option 1 is cleanest and minimal. Let me revise the plan.

Actually, let me rethink. The simpler approach:

For `cupsCollide`, I should just test it inline (duplicate the function) since it's a pure function that depends on module-level state. Or better: make it accept glass0/glass1 as parameters. But that changes production code.

The pragmatic approach: add minimal test-only exports. Let me add a few lines to main.js:

```js
// Test-only exports for module state injection
export function _setGlass0(g) { glass0 = g }
export function _setGlass1(g) { glass1 = g }
export function _resetGameOver() { gameOver = false }
```

These are simple setters. Very minimal.

Let me adjust the plan.

OK this is getting complicated. Let me simplify the main.js tests drastically:

1. Test `randomNumBetween` — pure function, no dependencies
2. Test `createLiquid` — depends on engine (pass it in), Matter.js
3. Test `triggerEndGame` — depends on DOM, gameOver, glass0, glass1
4. Test `cupsCollide` — depends on glass0, glass1
5. Test `clear` — depends on engine, render, runner

For #3 and #4, I'll use module-level imports and manually assign via exported setters.

Let me finalize the plan with this approach.<｜end▁of▁thinking｜>Let me revise the plan — handling ESM module state correctly.

<｜DSML｜tool_calls>
<｜DSML｜invoke name="write">
<｜DSML｜parameter name="content" string="true"># Test Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add unit and integration tests for glass.js, liquid-renderer.js, and main.js using Vitest with jsdom and headless-gl.

**Architecture:** Three test files in `tests/` — one per source module. Vitest runs in jsdom environment for DOM globals. liquid-renderer.js tests use headless-gl (`gl`) for a real WebGL 1.0 context. main.js gets minimal `export` keywords added (no behavior change) plus three test-only state setter exports.

**Tech Stack:** Vitest, jsdom, gl (headless-gl), Matter.js (existing)

---

### Task 0: Install test dependencies and configure Vitest

**Files:**
- Modify: `package.json`
- Create: `vitest.config.js`
- Create: `tests/vitest.setup.js`

- [ ] **Step 1: Install dependencies**

```bash
npm install --save-dev vitest jsdom gl
```

Expected: all three packages install. `gl` compiles native bindings (macOS uses system OpenGL framework).

- [ ] **Step 2: Add test script to package.json**

In `package.json`, after `"preview": "vite preview"`, add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Create vitest.config.js**

```js
import {defineConfig} from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/vitest.setup.js']
  }
})
```

- [ ] **Step 4: Create tests/vitest.setup.js**

```js
import {JSDOM} from 'jsdom'

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost',
  pretendToBeVisual: true
})

globalThis.window = dom.window
globalThis.document = dom.window.document
globalThis.innerWidth = 800
globalThis.innerHeight = 600
globalThis.navigator = dom.window.navigator
globalThis.HTMLCanvasElement = dom.window.HTMLCanvasElement
```

- [ ] **Step 5: Verify vitest runs (zero tests)**

```bash
npx vitest run
```

Expected: "No test files found" or exit code 0.

- [ ] **Step 6: Commit**

```bash
git add package.json vitest.config.js tests/vitest.setup.js
git commit -m "chore: add vitest, jsdom, and headless-gl test infrastructure"
```

---

### Task 1: glass.js unit tests

**Files:**
- Create: `tests/glass.test.js`

- [ ] **Step 1: Write failing test for DIFFICULTY_CONFIGS**

Create `tests/glass.test.js`:

```js
import {describe, it, expect} from 'vitest'
import {DIFFICULTY_CONFIGS} from '../glass.js'

describe('DIFFICULTY_CONFIGS', () => {
  it('has easy, normal, and hard keys in order', () => {
    expect(Object.keys(DIFFICULTY_CONFIGS)).toEqual(['easy', 'normal', 'hard'])
  })

  it('color values are in valid 0–1 range for every difficulty', () => {
    for (const key of Object.keys(DIFFICULTY_CONFIGS)) {
      const [r, g, b, a] = DIFFICULTY_CONFIGS[key].color
      for (const ch of [r, g, b, a]) {
        expect(ch).toBeGreaterThanOrEqual(0)
        expect(ch).toBeLessThanOrEqual(1)
      }
    }
  })

  it('every difficulty has wallAngleDeg and particles as positive numbers', () => {
    for (const cfg of Object.values(DIFFICULTY_CONFIGS)) {
      expect(typeof cfg.wallAngleDeg).toBe('number')
      expect(cfg.wallAngleDeg).toBeGreaterThan(0)
      expect(typeof cfg.particles).toBe('number')
      expect(cfg.particles).toBeGreaterThan(0)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it passes**

```bash
npx vitest run tests/glass.test.js
```

Expected: 3 tests pass.

- [ ] **Step 3: Add Glass geometry and behavior tests**

Replace `tests/glass.test.js` with:

```js
import {describe, it, expect, beforeEach} from 'vitest'
import {Bodies, Body, Composite, Engine} from 'matter-js'
import {Glass, DIFFICULTY_CONFIGS} from '../glass.js'

describe('DIFFICULTY_CONFIGS', () => {
  it('has easy, normal, and hard keys in order', () => {
    expect(Object.keys(DIFFICULTY_CONFIGS)).toEqual(['easy', 'normal', 'hard'])
  })

  it('color values are in valid 0–1 range for every difficulty', () => {
    for (const key of Object.keys(DIFFICULTY_CONFIGS)) {
      const [r, g, b, a] = DIFFICULTY_CONFIGS[key].color
      for (const ch of [r, g, b, a]) {
        expect(ch).toBeGreaterThanOrEqual(0)
        expect(ch).toBeLessThanOrEqual(1)
      }
    }
  })

  it('every difficulty has wallAngleDeg and particles as positive numbers', () => {
    for (const cfg of Object.values(DIFFICULTY_CONFIGS)) {
      expect(typeof cfg.wallAngleDeg).toBe('number')
      expect(cfg.wallAngleDeg).toBeGreaterThan(0)
      expect(typeof cfg.particles).toBe('number')
      expect(cfg.particles).toBeGreaterThan(0)
    }
  })
})

describe('Glass', () => {
  let engine

  beforeEach(() => {
    globalThis.innerWidth = 800
    globalThis.innerHeight = 600
    engine = Engine.create()
  })

  function makeImg(id) {
    const existing = document.getElementById(id)
    if (existing) existing.remove()
    const img = document.createElement('img')
    img.id = id
    img.style = {}
    document.body.appendChild(img)
    return img
  }

  it('creates a compound body with 5 parts (left, right, bottom, leftTip, rightTip)', () => {
    const g = new Glass({x: 400, y: 300}, engine, makeImg('glass0'), false, DIFFICULTY_CONFIGS.normal)
    expect(g.glass.parts.length).toBe(5)
    expect(g.leftTip).toBeDefined()
    expect(g.rightTip).toBeDefined()
  })

  it('mirrored glass has xCorrection = -11, non-mirrored has xCorrection = 11', () => {
    const mirrored = new Glass({x: 400, y: 300}, engine, makeImg('mirrored'), true, DIFFICULTY_CONFIGS.normal)
    const normal   = new Glass({x: 400, y: 300}, engine, makeImg('normal'), false, DIFFICULTY_CONFIGS.normal)
    expect(mirrored.xCorrection).toBe(-11)
    expect(normal.xCorrection).toBe(11)
  })

  it('_makeTransform includes scaleX(-1) for mirrored cups', () => {
    const g = new Glass({x: 400, y: 300}, engine, makeImg('glass-m'), true, DIFFICULTY_CONFIGS.normal)
    const t = g._makeTransform(400, 300, 0)
    expect(t).toContain('scaleX(-1)')
  })

  it('_makeTransform does NOT include scaleX(-1) for non-mirrored cups', () => {
    const g = new Glass({x: 400, y: 300}, engine, makeImg('glass-n'), false, DIFFICULTY_CONFIGS.normal)
    const t = g._makeTransform(400, 300, 0)
    expect(t).not.toContain('scaleX(-1)')
  })

  it('updatePosition clamps x to [0, innerWidth]', () => {
    const g = new Glass({x: 400, y: 300}, engine, makeImg('glass-clamp'), false, DIFFICULTY_CONFIGS.normal)
    g.control.left = true
    for (let i = 0; i < 200; i++) g.updatePosition()
    expect(g.getPosition().x).toBeGreaterThanOrEqual(0)

    g.control.left = false
    g.control.right = true
    for (let i = 0; i < 200; i++) g.updatePosition()
    expect(g.getPosition().x).toBeLessThanOrEqual(innerWidth)
  })

  it('updatePosition clamps y to [0, innerHeight-20]', () => {
    const g = new Glass({x: 400, y: 300}, engine, makeImg('glass-cy'), false, DIFFICULTY_CONFIGS.normal)
    g.control.up = true
    for (let i = 0; i < 200; i++) g.updatePosition()
    expect(g.getPosition().y).toBeGreaterThanOrEqual(0)

    g.control.up = false
    g.control.down = true
    for (let i = 0; i < 200; i++) g.updatePosition()
    expect(g.getPosition().y).toBeLessThanOrEqual(innerHeight - 20)
  })

  it('getLowestCupLipPoint returns the max Y of leftTip and rightTip', () => {
    const g = new Glass({x: 400, y: 300}, engine, makeImg('glass-lip'), false, DIFFICULTY_CONFIGS.normal)
    const lipY = g.getLowestCupLipPoint()
    expect(lipY).toBe(Math.max(g.leftTip.position.y, g.rightTip.position.y))
  })
})
```

- [ ] **Step 4: Run all glass tests**

```bash
npx vitest run tests/glass.test.js
```

Expected: 10 tests pass.

- [ ] **Step 5: Commit**

```bash
git add tests/glass.test.js
git commit -m "test: add glass.js unit tests for configs, geometry, transforms, and clamping"
```

---

### Task 2: liquid-renderer.js WebGL integration tests

**Files:**
- Create: `tests/liquid-renderer.test.js`
- Modify: `tests/vitest.setup.js`

- [ ] **Step 1: Update vitest.setup.js to inject headless WebGL context**

Replace `tests/vitest.setup.js` completely:

```js
import {JSDOM} from 'jsdom'
import createContext from 'gl'

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost',
  pretendToBeVisual: true
})

globalThis.window = dom.window
globalThis.document = dom.window.document
globalThis.innerWidth = 800
globalThis.innerHeight = 600
globalThis.navigator = dom.window.navigator
globalThis.HTMLCanvasElement = dom.window.HTMLCanvasElement

const OrigCanvas = dom.window.HTMLCanvasElement
dom.window.HTMLCanvasElement.prototype.getContext = function (type, attrs) {
  if (type === 'webgl') {
    const ctx = createContext(800, 600, {preserveDrawingBuffer: true, alpha: true})
    ctx.canvas = this
    return ctx
  }
  return OrigCanvas.prototype.getContext.call(this, type, attrs)
}
```

- [ ] **Step 2: Write liquid-renderer.js tests**

Create `tests/liquid-renderer.test.js`:

```js
import {describe, it, expect, beforeEach} from 'vitest'

describe('LiquidRenderer', () => {
  let LiquidRenderer

  beforeEach(() => {
    const existing = document.getElementById('webgl-canvas')
    if (existing) existing.remove()
    const canvas = document.createElement('canvas')
    canvas.id = 'webgl-canvas'
    document.body.appendChild(canvas)
    globalThis.innerWidth = 800
    globalThis.innerHeight = 600
    // Fresh dynamic import so getContext patch is resolved at module load
    LiquidRenderer = requireFresh()
  })

  it('constructor initializes without throwing for valid color', () => {
    expect(() => new LiquidRenderer([1, 0, 0, 1])).not.toThrow()
  })

  it('creates a non-lost WebGL context', () => {
    const lr = new LiquidRenderer([1, 0, 0, 1])
    expect(lr.gl).toBeDefined()
    expect(lr.gl.isContextLost()).toBe(false)
  })

  it('resize updates canvas dimensions to match innerWidth/innerHeight', () => {
    const lr = new LiquidRenderer([1, 0, 0, 1])
    globalThis.innerWidth = 1024
    globalThis.innerHeight = 768
    lr.resize()
    expect(lr.canvas.width).toBe(1024)
    expect(lr.canvas.height).toBe(768)
  })

  it('destroy triggers WebGL context loss via WEBGL_lose_context', () => {
    const lr = new LiquidRenderer([1, 0, 0, 1])
    lr.destroy()
    expect(lr.gl.isContextLost()).toBe(true)
  })

  it('render with particles clears and draws without throwing', () => {
    const lr = new LiquidRenderer([1, 0, 0, 1])
    const circles0 = [{position: {x: 100, y: 100}}]
    const circles1 = [{position: {x: 200, y: 200}}]
    expect(() => lr.render(circles0, circles1)).not.toThrow()
  })

  it('render with empty particle arrays does not throw', () => {
    const lr = new LiquidRenderer([1, 0, 0, 1])
    expect(() => lr.render([], [])).not.toThrow()
  })

  it('_renderScale defaults to 1.0 with headless-gl (non-Apple GPU)', () => {
    const lr = new LiquidRenderer([1, 0, 0, 1])
    expect(lr._renderScale).toBe(1.0)
  })
})

function requireFresh() {
  // Invalidate existing module cache and re-import
  const path = process.cwd() + '/liquid-renderer.js'
  const key = Object.keys(require.cache).find(k => k === path)
  if (key) delete require.cache[key]
  // Vitest transforms ESM — use dynamic import via createRequire
  const {createRequire} = require('module')
  const req = createRequire(import.meta.url)
  if (req.cache) {
    const cached = Object.keys(req.cache).find(k => k.includes('liquid-renderer'))
    if (cached) delete req.cache[cached]
  }
  const mod = req(path)
  return mod.LiquidRenderer
}
```

Hmm — vitest uses ESM, `require.cache` won't work. Let me use a simpler approach: since the setup file patches `getContext` before any test files load, the import at the top of the test file will already see the patched context. No need for dynamic reloading.

- [ ] **Step 2 (final): Write liquid-renderer.js tests with static import**

Create `tests/liquid-renderer.test.js`:

```js
import {describe, it, expect, beforeEach} from 'vitest'
import {LiquidRenderer} from '../liquid-renderer.js'

describe('LiquidRenderer', () => {
  beforeEach(() => {
    const existing = document.getElementById('webgl-canvas')
    if (existing) existing.remove()
    const canvas = document.createElement('canvas')
    canvas.id = 'webgl-canvas'
    document.body.appendChild(canvas)
    globalThis.innerWidth = 800
    globalThis.innerHeight = 600
  })

  it('constructor initializes without throwing for valid color', () => {
    expect(() => new LiquidRenderer([1, 0, 0, 1])).not.toThrow()
  })

  it('creates a non-lost WebGL context', () => {
    const lr = new LiquidRenderer([1, 0, 0, 1])
    expect(lr.gl).toBeDefined()
    expect(lr.gl.isContextLost()).toBe(false)
  })

  it('resize updates canvas dimensions to match innerWidth/innerHeight', () => {
    const lr = new LiquidRenderer([1, 0, 0, 1])
    globalThis.innerWidth = 1024
    globalThis.innerHeight = 768
    lr.resize()
    expect(lr.canvas.width).toBe(1024)
    expect(lr.canvas.height).toBe(768)
  })

  it('destroy triggers WebGL context loss via WEBGL_lose_context', () => {
    const lr = new LiquidRenderer([1, 0, 0, 1])
    lr.destroy()
    expect(lr.gl.isContextLost()).toBe(true)
  })

  it('render with particles clears and draws without throwing', () => {
    const lr = new LiquidRenderer([1, 0, 0, 1])
    const circles0 = [{position: {x: 100, y: 100}}]
    const circles1 = [{position: {x: 200, y: 200}}]
    expect(() => lr.render(circles0, circles1)).not.toThrow()
  })

  it('render with empty particle arrays does not throw', () => {
    const lr = new LiquidRenderer([1, 0, 0, 1])
    expect(() => lr.render([], [])).not.toThrow()
  })

  it('_renderScale defaults to 1.0 with headless-gl (non-Apple GPU)', () => {
    const lr = new LiquidRenderer([1, 0, 0, 1])
    expect(lr._renderScale).toBe(1.0)
  })
})
```

- [ ] **Step 3: Run liquid-renderer tests**

```bash
npx vitest run tests/liquid-renderer.test.js
```

Expected: 7 tests pass. If `gl` native bindings fail, check platform deps (macOS: no extra deps).

- [ ] **Step 4: Commit**

```bash
git add tests/liquid-renderer.test.js tests/vitest.setup.js
git commit -m "test: add liquid-renderer.js WebGL integration tests"
```

---

### Task 3: main.js game logic integration tests

**Files:**
- Create: `tests/main.test.js`
- Modify: `main.js` (add `export` keywords + test-only setters)
- Modify: `tests/vitest.setup.js`

- [ ] **Step 1: Add DOM elements to vitest.setup.js**

Append to `tests/vitest.setup.js`:

```js
function ensureEl(tag, id) {
  if (!document.getElementById(id)) {
    const el = document.createElement(tag)
    el.id = id
    document.body.appendChild(el)
  }
  return document.getElementById(id)
}
ensureEl('canvas', 'matter-canvas')
ensureEl('div', 'endgame')
ensureEl('div', 'endgame-reason')
ensureEl('div', 'foreground')
ensureEl('div', 'background')
ensureEl('div', 'touch-controls')
for (const id of ['glass0', 'glass1']) {
  if (!document.getElementById(id)) {
    const img = document.createElement('img')
    img.id = id
    img.style = {}
    document.body.appendChild(img)
  }
}
```

- [ ] **Step 2: Export functions and add test-only setters to main.js**

In `main.js`, make these changes:

Change line 26 `let engine, render, runner, mouse` to:
```js
export let engine, render, runner, mouse
```

Change line 28-29 `let glass0, glass1` to:
```js
export let glass0, glass1
```

Change line 30 `let gameOver = false` to:
```js
export let gameOver = false
```

Change line 32 `function clear() {` to:
```js
export function clear() {
```

Change line 39 `function init() {` to:
```js
export function init() {
```

Change line 63 `function createLiquid(pos, num, targetArray) {` to:
```js
export function createLiquid(pos, num, targetArray) {
```

Change line 80 `function cupsCollide() {` to:
```js
export function cupsCollide() {
```

Change line 91 `function triggerEndGame(winner, reason) {` to:
```js
export function triggerEndGame(winner, reason) {
```

Change line 116 `function startGame(config) {` to:
```js
export function startGame(config) {
```

Change line 214 `function setupTouchControls() {` to:
```js
export function setupTouchControls() {
```

Change line 235 `function randomNumBetween(min, max) {` to:
```js
export function randomNumBetween(min, max) {
```

Add after the `let gameOver = false` line:
```js
// Test-only: inject cup references so tests can exercise cupsCollide/triggerEndGame
export function _setGlasses(g0, g1) { glass0 = g0; glass1 = g1 }
```

- [ ] **Step 3: Verify vitest still runs after main.js modification**

```bash
npm run build
```

Expected: builds cleanly (exports are additive).

- [ ] **Step 4: Write main.js tests**

Create `tests/main.test.js`:

```js
import {vi, describe, it, expect, beforeEach} from 'vitest'
import {Bodies, Body, Bounds, Composite, Engine, Render, Runner} from 'matter-js'
import {Glass, DIFFICULTY_CONFIGS} from '../glass.js'

vi.mock('@rwh/keystrokes', () => ({
  bindKey: vi.fn(),
  unbindKey: vi.fn()
}))

import {
  createLiquid,
  cupsCollide,
  triggerEndGame,
  randomNumBetween,
  clear,
  engine,
  render,
  runner,
  _setGlasses,
  init
} from '../main.js'

function makeImg(id) {
  const existing = document.getElementById(id)
  if (existing) existing.remove()
  const img = document.createElement('img')
  img.id = id
  img.style = {}
  document.body.appendChild(img)
  return img
}

describe('createLiquid', () => {
  let eng

  beforeEach(() => {
    globalThis.innerWidth = 800
    globalThis.innerHeight = 600
    eng = Engine.create()
  })

  it('creates the specified number of particles in the target array', () => {
    const circles = []
    createLiquid({x: 400, y: 300}, 10, circles)
    expect(circles.length).toBe(10)
  })

  it('particle radius is between 6 and 7', () => {
    const circles = []
    createLiquid({x: 400, y: 300}, 20, circles)
    for (const c of circles) {
      expect(c.circleRadius).toBeGreaterThanOrEqual(6)
      expect(c.circleRadius).toBeLessThanOrEqual(7)
    }
  })

  it('adds particles to the engine world', () => {
    const before = Composite.allBodies(eng.world).length
    const circles = []
    createLiquid({x: 400, y: 300}, 5, circles)
    expect(Composite.allBodies(eng.world).length).toBe(before + 5)
  })
})

describe('cupsCollide', () => {
  let eng, g0, g1

  beforeEach(() => {
    globalThis.innerWidth = 800
    globalThis.innerHeight = 600
    eng = Engine.create()
    g0 = new Glass({x: 200, y: 400}, eng, makeImg('glass0-test'), true, DIFFICULTY_CONFIGS.normal)
    g1 = new Glass({x: 600, y: 400}, eng, makeImg('glass1-test'), false, DIFFICULTY_CONFIGS.normal)
    _setGlasses(g0, g1)
  })

  it('returns false when cups are far apart', () => {
    expect(cupsCollide()).toBe(false)
  })

  it('returns true when cups overlap', () => {
    Body.setPosition(g1.glass, {x: 250, y: 400})
    expect(cupsCollide()).toBe(true)
  })
})

describe('triggerEndGame', () => {
  let eng, g0, g1

  beforeEach(() => {
    eng = Engine.create()
    g0 = new Glass({x: 200, y: 500}, eng, makeImg('glass0-teg'), true, DIFFICULTY_CONFIGS.normal)
    g1 = new Glass({x: 600, y: 500}, eng, makeImg('glass1-teg'), false, DIFFICULTY_CONFIGS.normal)
    _setGlasses(g0, g1)

    document.getElementById('endgame').textContent = ''
    document.getElementById('endgame-reason').textContent = ''
    document.getElementById('foreground').style.display = 'none'
    document.getElementById('foreground').style.animation = ''
    document.getElementById('background').style.display = 'none'
    document.getElementById('background').style.animation = ''
  })

  it('sets endgame DOM text for left winner', () => {
    // Reset gameOver before each call
    import('../main.js').then(m => { Object.assign(m, {gameOver: false}) })
    triggerEndGame('left', '右方杯干')
    expect(document.getElementById('endgame').textContent).toBe('左方胜利！')
    expect(document.getElementById('endgame-reason').textContent).toBe('右方杯干')
    expect(document.getElementById('foreground').style.display).toBe('flex')
    expect(document.getElementById('background').style.display).toBe('flex')
  })

  it('is idempotent — second call with same gameOver=true does nothing', () => {
    import('../main.js').then(m => { Object.assign(m, {gameOver: false}) })
    triggerEndGame('left', 'reason1')
    const textAfterFirst = document.getElementById('endgame').textContent
    triggerEndGame('right', 'reason2')
    expect(document.getElementById('endgame').textContent).toBe(textAfterFirst)
  })
})

describe('randomNumBetween', () => {
  it('returns values within [min, max] over 100 iterations', () => {
    for (let i = 0; i < 100; i++) {
      const v = randomNumBetween(6, 7)
      expect(v).toBeGreaterThanOrEqual(6)
      expect(v).toBeLessThanOrEqual(7)
    }
  })
})

describe('clear', () => {
  it('stops and nulls engine, render, and runner', () => {
    const eng = Engine.create()
    const ren = Render.create({
      canvas: document.getElementById('matter-canvas'),
      engine: eng,
      options: {width: 800, height: 600, wireframes: false}
    })
    const run = Runner.create()
    Render.run(ren)
    Runner.run(run, eng)

    // Inject into module-level state
    import('../main.js').then(m => {
      Object.assign(m, {engine: eng, render: ren, runner: run, liquidRenderer: null})
      clear()
      // Verify module state was cleared
      expect(m.engine).toBeNull()
      expect(m.render).toBeNull()
      expect(m.runner).toBeNull()
    })
  })
})
```

Hmm — this `import('../main.js').then(m => ...)` approach is bad. ESM imports are live bindings for `export let` — I can import them and they reflect current module state. But I can't reassign them from outside the module.

Let me fix this. For the gameOver issue, I should add another setter. And for the clear() test, I need to import the module-level variables and call init() first.

- [ ] **Step 4 (final): Write main.js tests properly**

Create `tests/main.test.js`:

```js
import {vi, describe, it, expect, beforeEach} from 'vitest'
import {Bodies, Body, Composite, Engine, Render, Runner} from 'matter-js'
import {Glass, DIFFICULTY_CONFIGS} from '../glass.js'

vi.mock('@rwh/keystrokes', () => ({
  bindKey: vi.fn(),
  unbindKey: vi.fn()
}))

import {
  createLiquid,
  cupsCollide,
  triggerEndGame,
  randomNumBetween,
  clear,
  engine,
  render,
  runner,
  gameOver,
  _setGlasses,
  init
} from '../main.js'

function makeImg(id) {
  const existing = document.getElementById(id)
  if (existing) existing.remove()
  const img = document.createElement('img')
  img.id = id
  img.style = {}
  document.body.appendChild(img)
  return img
}

describe('createLiquid', () => {
  it('creates the specified number of particles', () => {
    globalThis.innerWidth = 800
    globalThis.innerHeight = 600
    init()
    const circles = []
    createLiquid({x: 400, y: 300}, 10, circles)
    expect(circles.length).toBe(10)
  })

  it('particle radius is between 6 and 7', () => {
    const circles = []
    createLiquid({x: 400, y: 300}, 20, circles)
    for (const c of circles) {
      expect(c.circleRadius).toBeGreaterThanOrEqual(6)
      expect(c.circleRadius).toBeLessThanOrEqual(7)
    }
  })

  it('adds particles to the engine world', () => {
    const before = Composite.allBodies(engine.world).length
    const circles = []
    createLiquid({x: 400, y: 300}, 5, circles)
    expect(Composite.allBodies(engine.world).length).toBe(before + 5)
  })
})

describe('cupsCollide', () => {
  let eng

  beforeEach(() => {
    globalThis.innerWidth = 800
    globalThis.innerHeight = 600
    eng = Engine.create()
  })

  it('returns false when cups are far apart', () => {
    const g0 = new Glass({x: 200, y: 400}, eng, makeImg('cc0'), true, DIFFICULTY_CONFIGS.normal)
    const g1 = new Glass({x: 600, y: 400}, eng, makeImg('cc1'), false, DIFFICULTY_CONFIGS.normal)
    _setGlasses(g0, g1)
    expect(cupsCollide()).toBe(false)
  })

  it('returns true when cups overlap', () => {
    const g0 = new Glass({x: 200, y: 400}, eng, makeImg('cc2'), true, DIFFICULTY_CONFIGS.normal)
    const g1 = new Glass({x: 600, y: 400}, eng, makeImg('cc3'), false, DIFFICULTY_CONFIGS.normal)
    Body.setPosition(g1.glass, {x: 250, y: 400})
    _setGlasses(g0, g1)
    expect(cupsCollide()).toBe(true)
  })
})

describe('triggerEndGame', () => {
  beforeEach(() => {
    globalThis.innerWidth = 800
    globalThis.innerHeight = 600
    const eng = Engine.create()
    const g0 = new Glass({x: 200, y: 500}, eng, makeImg('teg0'), true, DIFFICULTY_CONFIGS.normal)
    const g1 = new Glass({x: 600, y: 500}, eng, makeImg('teg1'), false, DIFFICULTY_CONFIGS.normal)
    _setGlasses(g0, g1)

    document.getElementById('endgame').textContent = ''
    document.getElementById('endgame-reason').textContent = ''
    document.getElementById('foreground').style.display = 'none'
    document.getElementById('foreground').style.animation = ''
    document.getElementById('background').style.display = 'none'
    document.getElementById('background').style.animation = ''
  })

  it('sets endgame DOM text for left winner', () => {
    // _resetGameOver is needed — import adds below
    triggerEndGame('left', '右方杯干')
    expect(document.getElementById('endgame').textContent).toBe('左方胜利！')
    expect(document.getElementById('endgame-reason').textContent).toBe('右方杯干')
    expect(document.getElementById('foreground').style.display).toBe('flex')
    expect(document.getElementById('background').style.display).toBe('flex')
  })
})

describe('randomNumBetween', () => {
  it('returns values within [min, max] over 100 iterations', () => {
    for (let i = 0; i < 100; i++) {
      const v = randomNumBetween(6, 7)
      expect(v).toBeGreaterThanOrEqual(6)
      expect(v).toBeLessThanOrEqual(7)
    }
  })
})

describe('clear', () => {
  it('stops Matter.js runner and sets refs to null', () => {
    init()
    // runner, render, engine are module-level — engine should be set after init()
    expect(engine).toBeDefined()
    expect(runner).toBeDefined()
    expect(render).toBeDefined()

    clear()

    // After clear, the exported bindings should reflect null
    // (clear() reassigns the module-level lets via the exported setters pattern)
  })
})
```

OK I'm going in circles. The issue is that `export let` bindings are live in ESM — you can read them but not write to them from outside the module. `clear()` reassigns `engine = null` etc. inside the module, and the exported binding will reflect that. So `import { engine }` after `clear()` should show `null`.

BUT — vitest runs tests sequentially within a file, and the same module instance is shared. So `init()` → `clear()` → check `engine` should work. Let me verify: yes, `clear()` sets `engine = null`, which reassigns the module-level `let engine`. The import binding `import { engine }` is live, so reading it after `clear()` returns `null`.

Let me write this test correctly.

Actually wait, `init()` calls `Engine.create()` and assigns to the module-level `engine`. Then `clear()` calls `Engine.clear(engine)` and sets `engine = null`. The live binding should reflect null.

Let me also handle `triggerEndGame` — it checks `gameOver`. I need either a setter or a way to reset it. Let me add `_resetGameOver()` as another test-only export.

OK, let me finalize the plan properly with these adjustments. I'll add two test-only exports:
- `_setGlasses(g0, g1)` 
- `_resetGameOver()`

Let me write the final version of the entire plan file.<｜end▁of▁thinking｜>Let me write the final clean plan.

<｜DSML｜tool_calls>
<｜DSML｜invoke name="write">
<｜DSML｜parameter name="content" string="true"># Test Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add unit and integration tests for glass.js, liquid-renderer.js, and main.js using Vitest with jsdom and headless-gl.

**Architecture:** Three test files in `tests/` — one per source module. Vitest runs in jsdom environment for DOM globals. liquid-renderer.js tests use headless-gl (`gl`) for a real WebGL 1.0 context. main.js gets `export` keywords added (additive, no behavior change) plus two test-only state setters.

**Tech Stack:** Vitest, jsdom, gl (headless-gl), Matter.js (existing)

---

### Task 0: Install test dependencies and configure Vitest

**Files:**
- Modify: `package.json`
- Create: `vitest.config.js`
- Create: `tests/vitest.setup.js`

- [ ] **Step 1: Install dependencies**

```bash
npm install --save-dev vitest jsdom gl
```

Expected: all three packages install. `gl` may compile native bindings.

- [ ] **Step 2: Add test script to package.json**

After `"preview": "vite preview"`, add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Create vitest.config.js**

```js
import {defineConfig} from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/vitest.setup.js']
  }
})
```

- [ ] **Step 4: Create tests/vitest.setup.js**

```js
import {JSDOM} from 'jsdom'

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost',
  pretendToBeVisual: true
})

globalThis.window = dom.window
globalThis.document = dom.window.document
globalThis.innerWidth = 800
globalThis.innerHeight = 600
globalThis.navigator = dom.window.navigator
globalThis.HTMLCanvasElement = dom.window.HTMLCanvasElement
```

- [ ] **Step 5: Verify vitest runs (zero tests)**

```bash
npx vitest run
```

Expected: exit code 0, "0 test files" or similar.

- [ ] **Step 6: Commit**

```bash
git add package.json vitest.config.js tests/vitest.setup.js
git commit -m "chore: add vitest, jsdom, and headless-gl test infrastructure"
```

---

### Task 1: glass.js unit tests

**Files:**
- Create: `tests/glass.test.js`

- [ ] **Step 1: Write all glass.js tests**

Create `tests/glass.test.js`:

```js
import {describe, it, expect, beforeEach} from 'vitest'
import {Bodies, Body, Composite, Engine} from 'matter-js'
import {Glass, DIFFICULTY_CONFIGS} from '../glass.js'

describe('DIFFICULTY_CONFIGS', () => {
  it('has easy, normal, and hard keys in order', () => {
    expect(Object.keys(DIFFICULTY_CONFIGS)).toEqual(['easy', 'normal', 'hard'])
  })

  it('color values are in valid 0–1 range for every difficulty', () => {
    for (const key of Object.keys(DIFFICULTY_CONFIGS)) {
      const [r, g, b, a] = DIFFICULTY_CONFIGS[key].color
      for (const ch of [r, g, b, a]) {
        expect(ch).toBeGreaterThanOrEqual(0)
        expect(ch).toBeLessThanOrEqual(1)
      }
    }
  })

  it('every difficulty has wallAngleDeg and particles as positive numbers', () => {
    for (const cfg of Object.values(DIFFICULTY_CONFIGS)) {
      expect(typeof cfg.wallAngleDeg).toBe('number')
      expect(cfg.wallAngleDeg).toBeGreaterThan(0)
      expect(typeof cfg.particles).toBe('number')
      expect(cfg.particles).toBeGreaterThan(0)
    }
  })
})

describe('Glass', () => {
  let engine

  beforeEach(() => {
    globalThis.innerWidth = 800
    globalThis.innerHeight = 600
    engine = Engine.create()
  })

  function makeImg(id) {
    const existing = document.getElementById(id)
    if (existing) existing.remove()
    const img = document.createElement('img')
    img.id = id
    img.style = {}
    document.body.appendChild(img)
    return img
  }

  it('creates a compound body with 5 parts', () => {
    const g = new Glass({x: 400, y: 300}, engine, makeImg('glass0'), false, DIFFICULTY_CONFIGS.normal)
    expect(g.glass.parts.length).toBe(5)
    expect(g.leftTip).toBeDefined()
    expect(g.rightTip).toBeDefined()
  })

  it('mirrored glass has xCorrection = -11, non-mirrored has xCorrection = 11', () => {
    const mirrored = new Glass({x: 400, y: 300}, engine, makeImg('mirrored'), true, DIFFICULTY_CONFIGS.normal)
    const normal   = new Glass({x: 400, y: 300}, engine, makeImg('normal'), false, DIFFICULTY_CONFIGS.normal)
    expect(mirrored.xCorrection).toBe(-11)
    expect(normal.xCorrection).toBe(11)
  })

  it('_makeTransform includes scaleX(-1) for mirrored cups', () => {
    const g = new Glass({x: 400, y: 300}, engine, makeImg('glass-m'), true, DIFFICULTY_CONFIGS.normal)
    expect(g._makeTransform(400, 300, 0)).toContain('scaleX(-1)')
  })

  it('_makeTransform does NOT include scaleX(-1) for non-mirrored cups', () => {
    const g = new Glass({x: 400, y: 300}, engine, makeImg('glass-n'), false, DIFFICULTY_CONFIGS.normal)
    expect(g._makeTransform(400, 300, 0)).not.toContain('scaleX(-1)')
  })

  it('updatePosition clamps x to [0, innerWidth]', () => {
    const g = new Glass({x: 400, y: 300}, engine, makeImg('glass-clamp'), false, DIFFICULTY_CONFIGS.normal)
    g.control.left = true
    for (let i = 0; i < 200; i++) g.updatePosition()
    expect(g.getPosition().x).toBeGreaterThanOrEqual(0)

    g.control.left = false
    g.control.right = true
    for (let i = 0; i < 200; i++) g.updatePosition()
    expect(g.getPosition().x).toBeLessThanOrEqual(innerWidth)
  })

  it('updatePosition clamps y to [0, innerHeight-20]', () => {
    const g = new Glass({x: 400, y: 300}, engine, makeImg('glass-cy'), false, DIFFICULTY_CONFIGS.normal)
    g.control.up = true
    for (let i = 0; i < 200; i++) g.updatePosition()
    expect(g.getPosition().y).toBeGreaterThanOrEqual(0)

    g.control.up = false
    g.control.down = true
    for (let i = 0; i < 200; i++) g.updatePosition()
    expect(g.getPosition().y).toBeLessThanOrEqual(innerHeight - 20)
  })

  it('getLowestCupLipPoint returns max Y of leftTip and rightTip', () => {
    const g = new Glass({x: 400, y: 300}, engine, makeImg('glass-lip'), false, DIFFICULTY_CONFIGS.normal)
    expect(g.getLowestCupLipPoint()).toBe(Math.max(g.leftTip.position.y, g.rightTip.position.y))
  })
})
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
npx vitest run tests/glass.test.js
```

Expected: 10 tests pass.

- [ ] **Step 3: Commit**

```bash
git add tests/glass.test.js
git commit -m "test: add glass.js unit tests for configs, geometry, transforms, and clamping"
```

---

### Task 2: liquid-renderer.js WebGL integration tests

**Files:**
- Create: `tests/liquid-renderer.test.js`
- Modify: `tests/vitest.setup.js`

- [ ] **Step 1: Update vitest.setup.js to inject headless WebGL context**

Replace `tests/vitest.setup.js` completely:

```js
import {JSDOM} from 'jsdom'
import createContext from 'gl'

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost',
  pretendToBeVisual: true
})

globalThis.window = dom.window
globalThis.document = dom.window.document
globalThis.innerWidth = 800
globalThis.innerHeight = 600
globalThis.navigator = dom.window.navigator
globalThis.HTMLCanvasElement = dom.window.HTMLCanvasElement

// Patch canvas getContext: 'webgl' returns a headless-gl context
const OrigCanvas = dom.window.HTMLCanvasElement
dom.window.HTMLCanvasElement.prototype.getContext = function (type, attrs) {
  if (type === 'webgl') {
    const ctx = createContext(800, 600, {preserveDrawingBuffer: true, alpha: true})
    ctx.canvas = this
    return ctx
  }
  return OrigCanvas.prototype.getContext.call(this, type, attrs)
}
```

- [ ] **Step 2: Write liquid-renderer.js tests**

Create `tests/liquid-renderer.test.js`:

```js
import {describe, it, expect, beforeEach} from 'vitest'
import {LiquidRenderer} from '../liquid-renderer.js'

describe('LiquidRenderer', () => {
  beforeEach(() => {
    const existing = document.getElementById('webgl-canvas')
    if (existing) existing.remove()
    const canvas = document.createElement('canvas')
    canvas.id = 'webgl-canvas'
    document.body.appendChild(canvas)
    globalThis.innerWidth = 800
    globalThis.innerHeight = 600
  })

  it('constructor initializes without throwing for valid color', () => {
    expect(() => new LiquidRenderer([1, 0, 0, 1])).not.toThrow()
  })

  it('creates a non-lost WebGL context', () => {
    const lr = new LiquidRenderer([1, 0, 0, 1])
    expect(lr.gl).toBeDefined()
    expect(lr.gl.isContextLost()).toBe(false)
  })

  it('resize updates canvas dimensions to match innerWidth/innerHeight', () => {
    const lr = new LiquidRenderer([1, 0, 0, 1])
    globalThis.innerWidth = 1024
    globalThis.innerHeight = 768
    lr.resize()
    expect(lr.canvas.width).toBe(1024)
    expect(lr.canvas.height).toBe(768)
  })

  it('destroy triggers WebGL context loss', () => {
    const lr = new LiquidRenderer([1, 0, 0, 1])
    lr.destroy()
    expect(lr.gl.isContextLost()).toBe(true)
  })

  it('render with particles clears and draws without throwing', () => {
    const lr = new LiquidRenderer([1, 0, 0, 1])
    const circles0 = [{position: {x: 100, y: 100}}]
    const circles1 = [{position: {x: 200, y: 200}}]
    expect(() => lr.render(circles0, circles1)).not.toThrow()
  })

  it('render with empty particle arrays does not throw', () => {
    const lr = new LiquidRenderer([1, 0, 0, 1])
    expect(() => lr.render([], [])).not.toThrow()
  })

  it('_renderScale defaults to 1.0 with non-Apple GPU', () => {
    const lr = new LiquidRenderer([1, 0, 0, 1])
    expect(lr._renderScale).toBe(1.0)
  })
})
```

- [ ] **Step 3: Run liquid-renderer tests**

```bash
npx vitest run tests/liquid-renderer.test.js
```

Expected: 7 tests pass. If `gl` native bindings fail, verify platform deps (macOS: none needed).

- [ ] **Step 4: Commit**

```bash
git add tests/liquid-renderer.test.js tests/vitest.setup.js
git commit -m "test: add liquid-renderer.js WebGL integration tests"
```

---

### Task 3: main.js game logic tests

**Files:**
- Create: `tests/main.test.js`
- Modify: `main.js` (add `export` keywords + two test-only helpers)
- Modify: `tests/vitest.setup.js`

- [ ] **Step 1: Add DOM elements for main.js to vitest.setup.js**

Append to `tests/vitest.setup.js`:

```js
// DOM elements needed by main.js
function ensureEl(tag, id) {
  if (!document.getElementById(id)) {
    const el = document.createElement(tag)
    el.id = id
    document.body.appendChild(el)
  }
}
ensureEl('canvas', 'matter-canvas')
ensureEl('div', 'endgame')
ensureEl('div', 'endgame-reason')
ensureEl('div', 'foreground')
ensureEl('div', 'background')
ensureEl('div', 'touch-controls')
for (const id of ['glass0', 'glass1']) {
  if (!document.getElementById(id)) {
    const img = document.createElement('img')
    img.id = id
    img.style = {}
    document.body.appendChild(img)
  }
}
```

- [ ] **Step 2: Add exports to main.js**

In `main.js`, change these lines:

Line 26 — add `export`:
```js
export let engine, render, runner, mouse
```

Lines 28-29 — add `export`:
```js
export let glass0, glass1
```

Line 30 — add `export`:
```js
export let gameOver = false
```

Add after line 30:
```js
export function _setGlasses(g0, g1) { glass0 = g0; glass1 = g1 }
export function _resetGameOver() { gameOver = false }
```

Add `export` before each function keyword:
- Line 32: `export function clear() {`
- Line 39: `export function init() {`
- Line 63: `export function createLiquid(pos, num, targetArray) {`
- Line 80: `export function cupsCollide() {`
- Line 91: `export function triggerEndGame(winner, reason) {`
- Line 116: `export function startGame(config) {`
- Line 214: `export function setupTouchControls() {`
- Line 235: `export function randomNumBetween(min, max) {`

- [ ] **Step 3: Verify build still works after exports**

```bash
npm run build
```

Expected: builds cleanly.

- [ ] **Step 4: Write main.js tests**

Create `tests/main.test.js`:

```js
import {vi, describe, it, expect, beforeEach} from 'vitest'
import {Bodies, Body, Composite, Engine, Render, Runner} from 'matter-js'
import {Glass, DIFFICULTY_CONFIGS} from '../glass.js'

vi.mock('@rwh/keystrokes', () => ({
  bindKey: vi.fn(),
  unbindKey: vi.fn()
}))

import {
  createLiquid,
  cupsCollide,
  triggerEndGame,
  randomNumBetween,
  clear,
  init,
  engine,
  render,
  runner,
  gameOver,
  _setGlasses,
  _resetGameOver
} from '../main.js'

function makeImg(id) {
  const existing = document.getElementById(id)
  if (existing) existing.remove()
  const img = document.createElement('img')
  img.id = id
  img.style = {}
  document.body.appendChild(img)
  return img
}

describe('createLiquid', () => {
  beforeEach(() => {
    globalThis.innerWidth = 800
    globalThis.innerHeight = 600
    clear()
    init()
  })

  it('creates the specified number of particles', () => {
    const circles = []
    createLiquid({x: 400, y: 300}, 10, circles)
    expect(circles.length).toBe(10)
  })

  it('each particle radius is between 6 and 7', () => {
    const circles = []
    createLiquid({x: 400, y: 300}, 20, circles)
    for (const c of circles) {
      expect(c.circleRadius).toBeGreaterThanOrEqual(6)
      expect(c.circleRadius).toBeLessThanOrEqual(7)
    }
  })

  it('adds particles to the engine world', () => {
    const before = Composite.allBodies(engine.world).length
    const circles = []
    createLiquid({x: 400, y: 300}, 5, circles)
    expect(Composite.allBodies(engine.world).length).toBe(before + 5)
  })
})

describe('cupsCollide', () => {
  let eng

  beforeEach(() => {
    globalThis.innerWidth = 800
    globalThis.innerHeight = 600
    eng = Engine.create()
  })

  it('returns false when cups are far apart', () => {
    const g0 = new Glass({x: 200, y: 400}, eng, makeImg('cc0'), true, DIFFICULTY_CONFIGS.normal)
    const g1 = new Glass({x: 600, y: 400}, eng, makeImg('cc1'), false, DIFFICULTY_CONFIGS.normal)
    _setGlasses(g0, g1)
    expect(cupsCollide()).toBe(false)
  })

  it('returns true when cups overlap', () => {
    const g0 = new Glass({x: 200, y: 400}, eng, makeImg('cc2'), true, DIFFICULTY_CONFIGS.normal)
    const g1 = new Glass({x: 600, y: 400}, eng, makeImg('cc3'), false, DIFFICULTY_CONFIGS.normal)
    Body.setPosition(g1.glass, {x: 250, y: 400})
    _setGlasses(g0, g1)
    expect(cupsCollide()).toBe(true)
  })
})

describe('triggerEndGame', () => {
  beforeEach(() => {
    globalThis.innerWidth = 800
    globalThis.innerHeight = 600
    const eng = Engine.create()
    const g0 = new Glass({x: 200, y: 500}, eng, makeImg('teg0'), true, DIFFICULTY_CONFIGS.normal)
    const g1 = new Glass({x: 600, y: 500}, eng, makeImg('teg1'), false, DIFFICULTY_CONFIGS.normal)
    _setGlasses(g0, g1)
    _resetGameOver()

    document.getElementById('endgame').textContent = ''
    document.getElementById('endgame-reason').textContent = ''
    document.getElementById('foreground').style.display = 'none'
    document.getElementById('foreground').style.animation = ''
    document.getElementById('background').style.display = 'none'
    document.getElementById('background').style.animation = ''
  })

  it('sets endgame DOM text for left winner', () => {
    triggerEndGame('left', '右方杯干')
    expect(document.getElementById('endgame').textContent).toBe('左方胜利！')
    expect(document.getElementById('endgame-reason').textContent).toBe('右方杯干')
    expect(document.getElementById('foreground').style.display).toBe('flex')
    expect(document.getElementById('background').style.display).toBe('flex')
  })

  it('is idempotent when gameOver becomes true', () => {
    triggerEndGame('left', 'reason1')
    const text = document.getElementById('endgame').textContent
    triggerEndGame('right', 'reason2')
    expect(document.getElementById('endgame').textContent).toBe(text)
  })
})

describe('randomNumBetween', () => {
  it('returns values within [min, max] over 100 iterations', () => {
    for (let i = 0; i < 100; i++) {
      const v = randomNumBetween(6, 7)
      expect(v).toBeGreaterThanOrEqual(6)
      expect(v).toBeLessThanOrEqual(7)
    }
  })
})

describe('clear', () => {
  beforeEach(() => {
    globalThis.innerWidth = 800
    globalThis.innerHeight = 600
  })

  it('stops runner and nulls engine, render, and runner refs', () => {
    init()
    expect(engine).toBeDefined()
    expect(runner).toBeDefined()
    expect(render).toBeDefined()

    clear()

    expect(engine).toBeNull()
    expect(runner).toBeNull()
    expect(render).toBeNull()
  })
})
```

- [ ] **Step 5: Run main.js tests**

```bash
npx vitest run tests/main.test.js
```

Expected: 9 tests pass.

- [ ] **Step 6: Run full test suite**

```bash
npm run test
```

Expected: 26 tests pass (10 glass + 7 liquid-renderer + 9 main).

- [ ] **Step 7: Commit**

```bash
git add tests/main.test.js main.js tests/vitest.setup.js
git commit -m "test: add main.js game logic tests with module exports"
```
