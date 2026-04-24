import {vi, describe, it, expect, beforeEach} from 'vitest'
import {Body, Composite, Engine, Render, Runner} from 'matter-js'
import {Glass, DIFFICULTY_CONFIGS} from '../glass.js'
import {LiquidRenderer} from '../liquid-renderer.js'

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

    document.getElementById('endgame').innerText = ''
    document.getElementById('endgame-reason').innerText = ''
    document.getElementById('foreground').style.display = 'none'
    document.getElementById('foreground').style.animation = ''
    document.getElementById('background').style.display = 'none'
    document.getElementById('background').style.animation = ''
  })

  it('sets endgame DOM text for left winner', () => {
    triggerEndGame('left', '右方杯干')
    expect(document.getElementById('endgame').innerText).toBe('左方胜利！')
    expect(document.getElementById('endgame-reason').innerText).toBe('右方杯干')
    expect(document.getElementById('foreground').style.display).toBe('flex')
    expect(document.getElementById('background').style.display).toBe('flex')
  })

  it('is idempotent when gameOver becomes true', () => {
    triggerEndGame('left', 'reason1')
    const text = document.getElementById('endgame').innerText
    triggerEndGame('right', 'reason2')
    expect(document.getElementById('endgame').innerText).toBe(text)
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
    expect(engine).not.toBeNull()
    expect(runner).not.toBeNull()
    expect(render).not.toBeNull()

    clear()

    expect(engine).toBeNull()
    expect(runner).toBeNull()
    expect(render).toBeNull()
  })
})
