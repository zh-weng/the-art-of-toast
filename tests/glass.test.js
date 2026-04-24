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

  it('creates a compound body with 6 parts (5 children + parent body)', () => {
    const g = new Glass({x: 400, y: 300}, engine, makeImg('glass0'), false, DIFFICULTY_CONFIGS.normal)
    expect(g.glass.parts.length).toBe(6)
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
