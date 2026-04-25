import {Bodies, Body, Bounds, Composite, Engine, Events, Mouse, Render, Runner} from 'matter-js'
import {Glass, DIFFICULTY_CONFIGS} from './glass.js'
import {bindKey, unbindKey} from '@rwh/keystrokes'
import {LiquidRenderer} from './liquid-renderer.js'

const canvas = document.querySelector('#matter-canvas')

if (import.meta.env.DEV) {
  const fps = document.createElement('div')
  fps.style.cssText = 'position:fixed;top:8px;left:8px;z-index:999;font:14px monospace;color:#fff;background:rgba(0,0,0,0.5);padding:2px 6px;border-radius:4px;pointer-events:none'
  document.body.appendChild(fps)
  let frames = 0, last = performance.now()
  const loop = () => {
    frames++
    const now = performance.now()
    if (now - last >= 500) {
      fps.textContent = `${Math.round(frames * 1000 / (now - last))} fps`
      frames = 0
      last = now
    }
    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)
}

export let engine, render, runner, mouse
let circles0 = [], circles1 = []
export let glass0, glass1
let liquidRenderer
export let gameOver = false
export function _setGlasses(g0, g1) { glass0 = g0; glass1 = g1 }
export function _resetGameOver() { gameOver = false }

export function clear() {
  if (liquidRenderer) { liquidRenderer.destroy(); liquidRenderer = null }
  if (runner)  { Runner.stop(runner);    runner = null }
  if (render)  { Render.stop(render);    render = null }
  if (engine)  { Engine.clear(engine);   engine = null }
}

export function init() {
  const { w, h } = getLogicalSize()
  engine = Engine.create({
    constraintIterations: 10,
    positionIterations: 10
  })
  render = Render.create({
    canvas: canvas,
    engine: engine,
    options: {
      width: w,
      height: h,
      wireframes: false,
      background: 'transparent',
      pixelRatio: 1
    }
  })
  mouse = Mouse.create(canvas)
  mouse.element.removeEventListener('mousewheel', mouse.mousewheel)
  mouse.element.removeEventListener('DOMMouseScroll', mouse.mousewheel)
  runner = Runner.create()
  Render.run(render)
  Runner.run(runner, engine)
}

export function createLiquid(pos, num, targetArray) {
  const radius = randomNumBetween(6, 7)
  for (let i = 0; i < num; ++i) {
    const body = Bodies.circle(pos.x, pos.y, radius, {
      friction: 0,
      density: 1,
      frictionAir: 0.05,
      restitution: 0.7
    })
    Body.applyForce(body, body.position, {x: 1, y: 0})
    Composite.add(engine.world, body)
    targetArray.push(body)
  }
}

// Parts-level bounds check: more precise than compound body AABB.
// parts[0] is the compound body itself; skip it and check individual sub-parts only.
export function cupsCollide() {
  const parts0 = glass0.glass.parts.slice(1)
  const parts1 = glass1.glass.parts.slice(1)
  for (const p0 of parts0) {
    for (const p1 of parts1) {
      if (Bounds.overlaps(p0.bounds, p1.bounds)) return true
    }
  }
  return false
}

export function triggerEndGame(winner, reason) {
  if (gameOver) return
  gameOver = true

  const boundKeys = 'qweasdiopkl;'
  for (const ch of boundKeys) unbindKey(ch)

  for (const g of [glass0, glass1]) {
    for (const key of Object.keys(g.control)) g.control[key] = false
  }

  const endGameTitle  = document.getElementById('endgame')
  const endGameReason = document.getElementById('endgame-reason')
  const foreground    = document.getElementById('foreground')
  const background    = document.getElementById('background')

  endGameTitle.innerText  = winner === 'left' ? '左方胜利！' : '右方胜利！'
  endGameReason.innerText = reason

  foreground.style.animation = 'fadeIn 0.5s'
  background.style.animation = 'fadeIn 0.5s'
  background.style.display   = 'flex'
  foreground.style.display   = 'flex'
}

export function startGame(config) {
  gameOver = false
  circles0 = []
  circles1 = []

  clear()
  init()

  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0
  const { w, h } = getLogicalSize()
  // On touch devices, cups start at 50% height to avoid being hidden under control strips
  const x0 = w * 0.3
  const x1 = w * 0.7
  const y  = isTouch ? h * 0.5 : h * 0.8
  const pos0 = {x: x0, y}
  const pos1 = {x: x1, y}

  glass0 = new Glass(pos0, engine, document.querySelector('#glass0'), true, config)
  glass1 = new Glass(pos1, engine, document.querySelector('#glass1'), false,  config)

  createLiquid(pos0, config.particles, circles0)
  createLiquid(pos1, config.particles, circles1)

  liquidRenderer = new LiquidRenderer(config.color)

  // Player 1 controls: WASD + QE
  bindKey('a', {onPressed: () => glass0.control.left  = true,  onReleased: () => glass0.control.left  = false})
  bindKey('d', {onPressed: () => glass0.control.right = true,  onReleased: () => glass0.control.right = false})
  bindKey('w', {onPressed: () => glass0.control.up    = true,  onReleased: () => glass0.control.up    = false})
  bindKey('s', {onPressed: () => glass0.control.down  = true,  onReleased: () => glass0.control.down  = false})
  bindKey('q', {onPressed: () => glass0.control.counterClockwise = true,  onReleased: () => glass0.control.counterClockwise = false})
  bindKey('e', {onPressed: () => glass0.control.clockwise        = true,  onReleased: () => glass0.control.clockwise        = false})

  // Player 2 controls: OPKL + I;
  bindKey('k', {onPressed: () => glass1.control.left  = true,  onReleased: () => glass1.control.left  = false})
  bindKey(';', {onPressed: () => glass1.control.right = true,  onReleased: () => glass1.control.right = false})
  bindKey('o', {onPressed: () => glass1.control.up    = true,  onReleased: () => glass1.control.up    = false})
  bindKey('l', {onPressed: () => glass1.control.down  = true,  onReleased: () => glass1.control.down  = false})
  bindKey('i', {onPressed: () => glass1.control.counterClockwise = true,  onReleased: () => glass1.control.counterClockwise = false})
  bindKey('p', {onPressed: () => glass1.control.clockwise        = true,  onReleased: () => glass1.control.clockwise        = false})

  if (isTouch) setupTouchControls()

  Events.on(runner, 'tick', () => {
    if (gameOver) return

    // Remove particles that have fallen off the bottom of the canvas
    const { h: lh } = getLogicalSize()
    for (const circles of [circles0, circles1]) {
      for (let i = circles.length - 1; i >= 0; i--) {
        if (circles[i].position.y - circles[i].circleRadius > lh) {
          Composite.remove(engine.world, circles[i])
          circles.splice(i, 1)
        }
      }
    }

    // Empty cup: all liquid has spilled — immediate loss
    if (circles0.length === 0) {
      triggerEndGame('right', '左方杯干')
      return
    }
    if (circles1.length === 0) {
      triggerEndGame('left', '右方杯干')
      return
    }

    // Cup collision: parts-level check is more precise than compound body AABB
    if (cupsCollide()) {
      const isLeftLower = glass0.getLowestCupLipPoint() > glass1.getLowestCupLipPoint()
      const winner = isLeftLower ? 'left' : 'right'
      const lowerSide = isLeftLower ? '左' : '右'
      triggerEndGame(winner, `${lowerSide}方杯口更低`)
    }

    glass0.updatePosition()
    glass1.updatePosition()
    liquidRenderer.render(circles0, circles1)
  })
}

// Difficulty selection — show start screen until a difficulty is picked
document.querySelectorAll('.diff-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.getElementById('start-screen').style.display = 'none'
    startGame(DIFFICULTY_CONFIGS[btn.dataset.diff])
  })
})

window.addEventListener('resize', () => {
  const { w, h } = getLogicalSize()
  if (render) {
    render.canvas.width  = w
    render.canvas.height = h
  }
  if (liquidRenderer) liquidRenderer.resize()
  // Reposition glass images to match new viewport size (fixes resize alignment bug)
  if (glass0) glass0.setPosition(glass0.getPosition())
  if (glass1) glass1.setPosition(glass1.getPosition())
})

// Also re-layout when orientation changes (phone rotation lock may still fire this)
window.addEventListener('orientationchange', () => {
  const { w, h } = getLogicalSize()
  if (render) {
    render.canvas.width  = w
    render.canvas.height = h
  }
  if (liquidRenderer) liquidRenderer.resize()
  if (glass0) glass0.setPosition(glass0.getPosition())
  if (glass1) glass1.setPosition(glass1.getPosition())
})

export function setupTouchControls() {
  document.getElementById('touch-controls').style.display = 'block'

  document.querySelectorAll('.ctrl-btn').forEach(btn => {
    const action = btn.dataset.action
    const getGlass = () => btn.dataset.player === '0' ? glass0 : glass1

    btn.addEventListener('touchstart', e => {
      e.preventDefault()
      getGlass().control[action] = true
    }, {passive: false})

    const release = e => {
      e?.preventDefault()
      getGlass().control[action] = false
    }
    btn.addEventListener('touchend',    release, {passive: false})
    btn.addEventListener('touchcancel', release)
  })
}

export function randomNumBetween(min, max) {
  return Math.random() * (max - min) + min
}

// Returns the logical game dimensions, swapped in portrait mode because
// the #game-root is rotated -90°: the game's coordinate space uses
// (landscape) dimensions regardless of the physical screen orientation.
function getLogicalSize() {
  const portrait = window.matchMedia('(orientation: portrait)').matches
  return portrait
    ? { w: window.innerHeight, h: window.innerWidth }
    : { w: window.innerWidth,  h: window.innerHeight }
}
