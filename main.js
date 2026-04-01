import {Bodies, Body, Bounds, Composite, Engine, Events, Mouse, Render, Runner} from 'matter-js'
import {Glass, DIFFICULTY_CONFIGS} from './glass.js'
import {bindKey, unbindKey} from '@rwh/keystrokes'

const canvas = document.querySelector('#matter-canvas')

const stdDeviation = [8, 10]
const colorMatrix = ['15 -3', '30 -5']

let engine, render, runner, mouse
let circles0 = [], circles1 = []
let glass0, glass1
let gameOver = false

function init() {
  engine = Engine.create({
    constraintIterations: 10,
    positionIterations: 10
  })
  render = Render.create({
    canvas: canvas,
    engine: engine,
    options: {
      width: innerWidth,
      height: innerHeight,
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

function createLiquid(pos, num, targetArray, color = '#fff') {
  const radius = randomNumBetween(6, 7)
  for (let i = 0; i < num; ++i) {
    const body = Bodies.circle(pos.x, pos.y, radius, {
      friction: 0,
      density: 1,
      frictionAir: 0,
      restitution: 0.7,
      render: {fillStyle: color}
    })
    Body.applyForce(body, body.position, {x: 1, y: 0})
    Composite.add(engine.world, body)
    targetArray.push(body)
  }
}

// Parts-level bounds check: more precise than compound body AABB.
// parts[0] is the compound body itself; skip it and check individual sub-parts only.
function cupsCollide() {
  const parts0 = glass0.glass.parts.slice(1)
  const parts1 = glass1.glass.parts.slice(1)
  for (const p0 of parts0) {
    for (const p1 of parts1) {
      if (Bounds.overlaps(p0.bounds, p1.bounds)) return true
    }
  }
  return false
}

function triggerEndGame(winner, reason) {
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

function startGame(config) {
  gameOver = false
  circles0 = []
  circles1 = []

  init()
  resizeFilter()

  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0
  // On touch devices, cups start at 50% height to avoid being hidden under control strips
  const x0 = innerWidth  * 0.3
  const x1 = innerWidth  * 0.7
  const y  = isTouch ? innerHeight * 0.5 : innerHeight * 0.8
  const pos0 = {x: x0, y}
  const pos1 = {x: x1, y}

  glass0 = new Glass(pos0, engine, document.querySelector('#glass0'), false, config)
  glass1 = new Glass(pos1, engine, document.querySelector('#glass1'), true,  config)

  createLiquid(pos0, config.particles, circles0)
  createLiquid(pos1, config.particles, circles1)

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
    for (const circles of [circles0, circles1]) {
      for (let i = circles.length - 1; i >= 0; i--) {
        if (circles[i].position.y - circles[i].circleRadius > innerHeight) {
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
      const winner = glass0.getLowestCupLipPoint() > glass1.getLowestCupLipPoint() ? 'left' : 'right'
      const loser  = winner === 'left' ? '右' : '左'
      triggerEndGame(winner, `${loser}方杯口最低`)
    }

    glass0.updatePosition()
    glass1.updatePosition()
  })
}

// Difficulty selection — show start screen until a difficulty is picked
document.querySelectorAll('.diff-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.getElementById('start-screen').style.display = 'none'
    startGame(DIFFICULTY_CONFIGS[btn.dataset.diff])
  })
})

resizeFilter()

window.addEventListener('resize', () => {
  if (render) {
    render.canvas.width  = innerWidth
    render.canvas.height = innerHeight
  }
  resizeFilter()
  // Reposition glass images to match new viewport size (fixes resize alignment bug)
  if (glass0) glass0.setPosition(glass0.getPosition())
  if (glass1) glass1.setPosition(glass1.getPosition())
})

function resizeFilter() {
  const feGaussianBlur = document.querySelector('#gooey feGaussianBlur')
  const feColorMatrix  = document.querySelector('#gooey feColorMatrix')
  const index = innerWidth < 600 ? 0 : 1
  feGaussianBlur.setAttribute('stdDeviation', stdDeviation[index])
  feColorMatrix.setAttribute('values', `1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 ${colorMatrix[index]}`)
}

function setupTouchControls() {
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

function randomNumBetween(min, max) {
  return Math.random() * (max - min) + min
}
