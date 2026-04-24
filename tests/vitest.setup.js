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
