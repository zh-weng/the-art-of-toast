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

  it('destroy triggers WebGL context loss by calling loseContext', () => {
    const lr = new LiquidRenderer([1, 0, 0, 1])
    let called = false
    const origGetExtension = lr.gl.getExtension.bind(lr.gl)
    lr.gl.getExtension = (name) => {
      if (name === 'WEBGL_lose_context') {
        return { loseContext: () => { called = true } }
      }
      return origGetExtension(name)
    }
    lr.destroy()
    expect(called).toBe(true)
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
