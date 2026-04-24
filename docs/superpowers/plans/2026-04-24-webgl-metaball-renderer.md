# WebGL Metaball Liquid Renderer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the SVG gooey filter with a WebGL fragment shader metaball renderer so the liquid effect runs on the GPU in Safari.

**Architecture:** A new `liquid-renderer.js` owns a `<canvas id="webgl-canvas">` layered over the hidden Matter.js canvas. Each tick `main.js` passes particle arrays to `LiquidRenderer.render()`, which uploads positions via a `ParticleUploader` and runs a fragment shader that computes the metaball field per-pixel. The Matter.js canvas stays (physics runs there) but is hidden; the SVG gooey filter is deleted entirely.

**Tech Stack:** Plain WebGL 1.0 (no libraries), Matter.js (existing), Vite (existing)

---

### Task 1: Add `<canvas id="webgl-canvas">` to HTML and wire CSS

**Files:**
- Modify: `index.html`
- Modify: `style.css`

- [ ] **Step 1: Add webgl-canvas element to index.html**

Find the line `<canvas id="matter-canvas"></canvas>` and add the webgl canvas immediately after it. Also delete the entire `<svg>` block that contains the gooey filter (lines containing `<svg>`, `<defs>`, `<filter id="gooey"...>`, `<feGaussianBlur.../>`, `<feColorMatrix.../>`, `</filter>`, `</defs>`, `</svg>`).

Result in index.html:
```html
<canvas id="matter-canvas"></canvas>
<canvas id="webgl-canvas"></canvas>
```
The `<svg>...</svg>` block is gone entirely.

- [ ] **Step 2: Update style.css**

Remove `filter: url(#gooey);` from `#matter-canvas`. Add `opacity: 0;` to `#matter-canvas`. Add a new rule for `#webgl-canvas`:

```css
#matter-canvas {
  width: 100%;
  height: 100%;
  flex-shrink: 0;
  opacity: 0;
}

#webgl-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 0;
}
```

- [ ] **Step 3: Verify the page still loads**

Run `npm run dev`, open browser. The game start screen should appear. The liquid particles will be invisible for now (WebGL renderer not wired yet) — that is expected.

- [ ] **Step 4: Commit**

```bash
git add index.html style.css
git commit -m "feat: add webgl-canvas element, hide matter-canvas, remove SVG gooey filter"
```

---

### Task 2: Create `liquid-renderer.js` with WebGL boilerplate

**Files:**
- Create: `liquid-renderer.js`

- [ ] **Step 1: Create the file with WebGL context setup and shader sources**

```js
const VERT_SRC = `
  attribute vec2 aPosition;
  void main() {
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }
`

// MAX_PARTICLES must match the largest particle count across all difficulties (easy=120).
// Increase this constant (and nothing else) to upgrade capacity.
const MAX_PARTICLES = 128

const FRAG_SRC = `
  precision mediump float;
  uniform vec2  uParticles[${MAX_PARTICLES}];
  uniform int   uCount;
  uniform float uRadius;
  uniform float uThreshold;
  uniform vec4  uColor;
  uniform vec2  uResolution;

  void main() {
    vec2 fragCoord = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y);
    float field = 0.0;
    for (int i = 0; i < ${MAX_PARTICLES}; i++) {
      if (i >= uCount) break;
      vec2 delta = uParticles[i] - fragCoord;
      float d2 = dot(delta, delta);
      if (d2 > 0.0) field += (uRadius * uRadius) / d2;
    }
    if (field < uThreshold) discard;
    gl_FragColor = uColor;
  }
`

function compileShader(gl, type, src) {
  const shader = gl.createShader(type)
  gl.shaderSource(shader, src)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error('Shader compile error: ' + gl.getShaderInfoLog(shader))
  }
  return shader
}

function createProgram(gl) {
  const prog = gl.createProgram()
  gl.attachShader(prog, compileShader(gl, gl.VERTEX_SHADER,   VERT_SRC))
  gl.attachShader(prog, compileShader(gl, gl.FRAGMENT_SHADER, FRAG_SRC))
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error('Program link error: ' + gl.getProgramInfoLog(prog))
  }
  return prog
}

// ParticleUploader: Phase A — uniform array upload.
// Phase B upgrade: replace this class with one that writes positions into a
// float texture and reads it in the shader; the LiquidRenderer interface is unchanged.
class ParticleUploader {
  constructor(gl, prog) {
    this.gl   = gl
    this.locs = []
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.locs.push(gl.getUniformLocation(prog, `uParticles[${i}]`))
    }
    this.countLoc = gl.getUniformLocation(prog, 'uCount')
  }

  upload(particles) {
    const { gl, locs, countLoc } = this
    const count = Math.min(particles.length, MAX_PARTICLES)
    gl.uniform1i(countLoc, count)
    for (let i = 0; i < count; i++) {
      gl.uniform2f(locs[i], particles[i].position.x, particles[i].position.y)
    }
  }
}

export class LiquidRenderer {
  // color: [r, g, b, a] each in 0–1 range
  constructor(color) {
    this.canvas = document.getElementById('webgl-canvas')
    const gl = this.canvas.getContext('webgl')
    if (!gl) throw new Error('WebGL not supported')
    this.gl = gl

    const prog = createProgram(gl)
    gl.useProgram(prog)

    // Full-screen quad — two triangles covering clip space
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,  1, -1,  -1, 1,
      -1,  1,  1, -1,   1, 1,
    ]), gl.STATIC_DRAW)
    const posLoc = gl.getAttribLocation(prog, 'aPosition')
    gl.enableVertexAttribArray(posLoc)
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)

    this.uploader    = new ParticleUploader(gl, prog)
    this.uResolution = gl.getUniformLocation(prog, 'uResolution')
    this.uRadius     = gl.getUniformLocation(prog, 'uRadius')
    this.uThreshold  = gl.getUniformLocation(prog, 'uThreshold')
    this.uColor      = gl.getUniformLocation(prog, 'uColor')

    gl.uniform1f(this.uRadius,    40.0)
    gl.uniform1f(this.uThreshold,  0.6)
    gl.uniform4f(this.uColor, color[0], color[1], color[2], color[3])

    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

    this.resize()
  }

  resize() {
    const { gl, canvas } = this
    canvas.width  = innerWidth
    canvas.height = innerHeight
    gl.viewport(0, 0, innerWidth, innerHeight)
    gl.uniform2f(this.uResolution, innerWidth, innerHeight)
  }

  // circles0 and circles1 are Matter.js Body arrays
  render(circles0, circles1) {
    const { gl } = this
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    const all = circles0.concat(circles1)
    this.uploader.upload(all)
    gl.drawArrays(gl.TRIANGLES, 0, 6)
  }
}
```

- [ ] **Step 2: Verify the file has no syntax errors**

```bash
node --input-type=module < liquid-renderer.js 2>&1 || true
```

Expected: either silent (no errors) or a single `ReferenceError: document is not defined` — that is fine because `document` only exists in the browser. Any other error means a syntax problem to fix.

- [ ] **Step 3: Commit**

```bash
git add liquid-renderer.js
git commit -m "feat: add LiquidRenderer with WebGL metaball shader and ParticleUploader"
```

---

### Task 3: Wire `LiquidRenderer` into `main.js`

**Files:**
- Modify: `main.js`

- [ ] **Step 1: Add the import at the top of main.js**

After the existing imports, add:

```js
import {LiquidRenderer} from './liquid-renderer.js'
```

- [ ] **Step 2: Add liquidRenderer variable declaration**

Add `liquidRenderer` to the existing `let` declarations block near the top of the file (alongside `engine`, `render`, `runner`, etc.):

```js
let engine, render, runner, mouse
let circles0 = [], circles1 = []
let glass0, glass1
let liquidRenderer
let gameOver = false
```

- [ ] **Step 3: Add color lookup to DIFFICULTY_CONFIGS in glass.js**

Open `glass.js` and add a `color` field to each difficulty entry. Colors are `[r, g, b, a]` in 0–1 range:

```js
export const DIFFICULTY_CONFIGS = {
  easy:   { wallAngleDeg: 8,  particles: 120, color: [240/255, 180/255,  40/255, 0.85] },
  normal: { wallAngleDeg: 15, particles: 100, color: [120/255,  20/255,  40/255, 0.85] },
  hard:   { wallAngleDeg: 22, particles: 80,  color: [220/255, 235/255, 255/255, 0.75] },
}
```

- [ ] **Step 4: Construct LiquidRenderer in startGame()**

In `startGame(config)`, after the `init()` and glass/liquid creation lines, add:

```js
liquidRenderer = new LiquidRenderer(config.color)
```

Also **delete** the `resizeFilter()` call that was here:
```js
// DELETE this line:
resizeFilter()
```

- [ ] **Step 5: Call render() each tick**

Inside `Events.on(runner, 'tick', () => { ... })`, at the very end (after `glass0.updatePosition()` and `glass1.updatePosition()`), add:

```js
liquidRenderer.render(circles0, circles1)
```

- [ ] **Step 6: Wire resize into the window resize handler**

In the existing `window.addEventListener('resize', ...)` callback, add:

```js
if (liquidRenderer) liquidRenderer.resize()
```

Place it alongside the existing `render.canvas.width` / `render.canvas.height` lines.

- [ ] **Step 7: Delete resizeFilter() entirely**

Remove the entire `resizeFilter` function from `main.js` (it was only needed for the SVG filter):

```js
// DELETE this entire function:
function resizeFilter() {
  const feGaussianBlur = document.querySelector('#gooey feGaussianBlur')
  const feColorMatrix  = document.querySelector('#gooey feColorMatrix')
  const index = innerWidth < 600 ? 0 : 1
  feGaussianBlur.setAttribute('stdDeviation', stdDeviation[index])
  feColorMatrix.setAttribute('values', `1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 ${colorMatrix[index]}`)
}
```

Also delete the two `const` declarations at the top of the file that are now unused:

```js
// DELETE these two lines:
const stdDeviation = [8, 10]
const colorMatrix = ['15 -3', '30 -5']
```

And delete the standalone `resizeFilter()` call near the bottom (the one outside `startGame`):

```js
// DELETE this line (it's outside startGame, called at module load time):
resizeFilter()
```

- [ ] **Step 8: Verify in browser**

Run `npm run dev`. Start a game. Liquid particles should now appear as colored blobs with metaball fusion. 
- Easy: amber/yellow
- Normal: dark red
- Hard: near-transparent white-blue

If particles are invisible, open DevTools console — a WebGL compile error will be printed there.

- [ ] **Step 9: Commit**

```bash
git add main.js glass.js
git commit -m "feat: wire LiquidRenderer into game loop, add difficulty colors, remove SVG filter code"
```

---

### Task 4: Tune shader parameters for visual parity

**Files:**
- Modify: `liquid-renderer.js`

The two key parameters in `LiquidRenderer` constructor are `uRadius` (40.0) and `uThreshold` (0.6). These control how blobs look and how readily they merge.

- [ ] **Step 1: Open the game and observe**

Run `npm run dev`, start on Easy. Watch the liquid. Compare mentally to the old gooey effect (white blobs that smoothly merge).

- [ ] **Step 2: Tune uRadius**

`uRadius` controls blob size. Particles have a physics radius of 6–7px. The current value of `40.0` makes each particle's influence extend roughly 40px. If blobs look too small/sparse, increase. If they look too fat, decrease. Edit the line in `liquid-renderer.js`:

```js
gl.uniform1f(this.uRadius, 40.0)  // adjust this value
```

- [ ] **Step 3: Tune uThreshold**

`uThreshold` controls the merge distance. Lower = blobs merge from further away (more "gooey"). Higher = blobs stay separate until very close. The current value of `0.6` is a reasonable starting point. Edit:

```js
gl.uniform1f(this.uThreshold, 0.6)  // adjust this value
```

- [ ] **Step 4: Test all three difficulties**

Switch through Easy / Normal / Hard and confirm:
- Colors are visually distinct and match the spec
- Blobs merge smoothly when close
- Hard (白酒) is subtle/near-transparent but still visible

- [ ] **Step 5: Commit with final values**

```bash
git add liquid-renderer.js
git commit -m "tune: adjust metaball radius and threshold for visual parity with old gooey filter"
```
