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
const OrigCanvas = dom.window.HTMLCanvasElement
dom.window.HTMLCanvasElement.prototype.getContext = function (type, attrs) {
  if (type === 'webgl') {
    const ctx = createContext(800, 600, {preserveDrawingBuffer: true, alpha: true})
    ctx.canvas = this
    return ctx
  }
  return OrigCanvas.prototype.getContext.call(this, type, attrs)
}

globalThis.requestAnimationFrame = dom.window.requestAnimationFrame
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame
globalThis.performance = dom.window.performance
globalThis.MutationObserver = dom.window.MutationObserver
globalThis.getComputedStyle = dom.window.getComputedStyle
