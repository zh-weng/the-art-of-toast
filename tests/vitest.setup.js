import {JSDOM} from 'jsdom'
import createContext from 'gl'

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost',
  pretendToBeVisual: true
})

globalThis.window = dom.window
globalThis.document = dom.window.document
globalThis.innerWidth = dom.window.innerWidth = 800
globalThis.innerHeight = dom.window.innerHeight = 600
Object.defineProperty(globalThis, 'navigator', {value: dom.window.navigator, configurable: true})
globalThis.HTMLCanvasElement = dom.window.HTMLCanvasElement

// Patch canvas getContext: 'webgl' returns a headless-gl context
const origGetContext = dom.window.HTMLCanvasElement.prototype.getContext
dom.window.HTMLCanvasElement.prototype.getContext = function (type, attrs) {
  if (type === 'webgl') {
    const ctx = createContext(800, 600, {preserveDrawingBuffer: true, alpha: true})
    ctx.canvas = this
    return ctx
  }
  if (type === '2d') {
    // jsdom lacks canvas 2d support; provide a minimal stub for Matter.js Render
    return {
      canvas: this,
      save: () => {},
      restore: () => {},
      translate: () => {},
      rotate: () => {},
      scale: () => {},
      beginPath: () => {},
      closePath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      arc: () => {},
      fill: () => {},
      stroke: () => {},
      fillRect: () => {},
      fillText: () => {},
      clip: () => {},
      drawImage: () => {},
      getImageData: () => ({data: new Uint8ClampedArray(4), width: 1, height: 1}),
      putImageData: () => {},
      createLinearGradient: () => ({addColorStop: () => {}}),
      createPattern: () => ({}),
      measureText: () => ({width: 0}),
      setTransform: () => {},
      getTransform: () => ({a: 1, b: 0, c: 0, d: 1, e: 0, f: 0}),
      resetTransform: () => {},
      get globalAlpha() { return 1 },
      set globalAlpha(_) {},
      get globalCompositeOperation() { return 'source-over' },
      set globalCompositeOperation(_) {},
      get lineWidth() { return 1 },
      set lineWidth(_) {},
      get strokeStyle() { return '#000' },
      set strokeStyle(_) {},
      get fillStyle() { return '#000' },
      set fillStyle(_) {},
      get font() { return '10px sans-serif' },
      set font(_) {},
      get textAlign() { return 'start' },
      set textAlign(_) {},
      get textBaseline() { return 'alphabetic' },
      set textBaseline(_) {},
      get shadowColor() { return 'transparent' },
      set shadowColor(_) {},
      get shadowBlur() { return 0 },
      set shadowBlur(_) {},
      get shadowOffsetX() { return 0 },
      set shadowOffsetX(_) {},
      get shadowOffsetY() { return 0 },
      set shadowOffsetY(_) {},
      get imageSmoothingEnabled() { return true },
      set imageSmoothingEnabled(_) {},
      clearRect: () => {},
      rect: () => {},
    }
  }
  return origGetContext.call(this, type, attrs)
}

globalThis.requestAnimationFrame = () => 0
globalThis.cancelAnimationFrame = () => {}
globalThis.performance.now = () => Date.now()
globalThis.MutationObserver = dom.window.MutationObserver
globalThis.getComputedStyle = dom.window.getComputedStyle

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
