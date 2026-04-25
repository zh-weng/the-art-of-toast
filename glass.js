import {Bodies, Body, Composite} from 'matter-js'

// Difficulty configs: wallAngleDeg controls how splayed the cup walls are (harder = more splayed),
// particles controls how much liquid each cup starts with.
export const DIFFICULTY_CONFIGS = {
  easy:   { wallAngleDeg: 8,  particles: 120, color: [240/255, 180/255,  40/255, 0.55] },
  normal: { wallAngleDeg: 15, particles: 100, color: [120/255,  20/255,  40/255, 0.55] },
  hard:   { wallAngleDeg: 22, particles: 80,  color: [220/255, 235/255, 255/255, 0.45] },
}

// Fixed cup geometry constants (match the original cup image proportions)
const LEFT_OFFSET  = -60  // left wall x from cup center
const RIGHT_OFFSET =  37  // right wall x from cup center
const WALL_LENGTH  = 150
const THICKNESS    =  25

export class Glass {
  // mirrored=true flips the cup horizontally so glass1 faces glass0 (handles outward)
  constructor(pos, engine, img, mirrored = false, config = DIFFICULTY_CONFIGS.normal) {
    const wallColor = '#00000000'
    this.glassImg = img
    this.glassImg.style.display = 'block'  // hidden by default in CSS, show now
    this.cx = pos.x
    this.cy = pos.y
    this.mirrored = mirrored
    // xCorrection: offset from physics centroid back to visual center.
    // Centroid of compound body ≈ cx + (lo+ro)/2.
    // For non-mirrored: (-60+37)/2 = -11.5, so correction = +11.
    // For mirrored:     (-37+60)/2 = +11.5, so correction = -11.
    this.xCorrection = mirrored ? -11 : 11
    this.control = {
      left: false, right: false, up: false, down: false,
      clockwise: false, counterClockwise: false,
    }

    // Flip left/right offsets for mirrored cup
    const lo = mirrored ? -RIGHT_OFFSET : LEFT_OFFSET
    const ro = mirrored ? -LEFT_OFFSET  : RIGHT_OFFSET
    const radians = Math.PI / 180 * config.wallAngleDeg
    const halfWall = WALL_LENGTH / 2

    this.leftTip = Bodies.circle(
      this.cx + lo - Math.sin(radians) * halfWall,
      this.cy - Math.cos(radians) * halfWall,
      1
    )
    this.rightTip = Bodies.circle(
      this.cx + ro + Math.sin(radians) * halfWall,
      this.cy - Math.cos(radians) * halfWall,
      1
    )
    const left = Bodies.rectangle(this.cx + lo, this.cy, THICKNESS, WALL_LENGTH, {
      chamfer: {radius: 10},
      angle: -radians,
      render: {fillStyle: wallColor}
    })
    const right = Bodies.rectangle(this.cx + ro, this.cy, THICKNESS, WALL_LENGTH, {
      chamfer: {radius: 10},
      angle: radians,
      render: {fillStyle: wallColor}
    })
    const bottom = Bodies.rectangle(
      this.cx + (lo + ro) / 2,
      this.cy + halfWall - 3,
      85, THICKNESS * 2,
      {chamfer: {radius: 20}, render: {fillStyle: wallColor}}
    )

    this.glass = Body.create({
      parts: [left, right, bottom, this.leftTip, this.rightTip],
      isStatic: true
    })
    Composite.add(engine.world, [this.glass])

    this.glassImg.style.transform = this._makeTransform(
      this.glass.position.x, this.glass.position.y, 0
    )
  }

  // Builds the CSS transform string.
  // The .glass images are positioned in the VIEWPORT (outside #game-root),
  // but comX/comY are in game-logical coordinates (inside the rotated game-root).
  // In portrait, game-root is rotate(-90deg), so the coordinate mapping is:
  //   game (gx, gy)  →  viewport (innerWidth - gy, gx)
  // In landscape there is no rotation, so viewport = game directly.
  _makeTransform = (comX, comY, angleDeg) => {
    const hw = (this.glassImg.offsetWidth  || 250) / 2
    const hh = (this.glassImg.offsetHeight || 200) / 2
    const portrait = window.matchMedia('(orientation: portrait)').matches

    let vpX, vpY
    if (portrait) {
      vpX = window.innerWidth - comY   // game y → viewport x (flipped)
      vpY = comX                       // game x → viewport y
    } else {
      vpX = comX
      vpY = comY
    }

    const tx = vpX - hw
    const ty = vpY - hh
    // In portrait the cup image needs +90° to match game-root's +90° rotation.
    const baseAngle = portrait ? 90 : 0
    const mirror = this.mirrored ? ' scaleX(-1)' : ''
    return `translate(${tx}px, ${ty}px) rotate(${angleDeg + baseAngle}deg) translate(${this.xCorrection}px, -25px)${mirror}`
  }

  setPosition = pos => {
    Body.setPosition(this.glass, {x: pos.x, y: pos.y})
    const angleDeg = Math.floor(180 * this.glass.angle / Math.PI)
    this.glassImg.style.transform = this._makeTransform(pos.x, pos.y, angleDeg)
  }

  setAngle = angle => {
    Body.setAngle(this.glass, angle)
    const pos = this.getPosition()
    this.glassImg.style.transform = this._makeTransform(
      pos.x, pos.y,
      Math.floor(180 * angle / Math.PI)
    )
  }

  getPosition = () => ({x: this.glass.position.x, y: this.glass.position.y})

  getLowestCupLipPoint = () => Math.max(this.leftTip.position.y, this.rightTip.position.y)

  updatePosition = () => {
    let pos = this.getPosition()
    const angle = this.glass.angle
    const portrait = window.matchMedia('(orientation: portrait)').matches

    let moveRight = this.control.right
    let moveLeft  = this.control.left
    let moveUp    = this.control.up
    let moveDown  = this.control.down

    // In portrait mode, users view the rotated screen from the physical top and bottom edges.
    // The directional controls must be remapped to maintain an intuitive physical mapping.
    if (portrait) {
      if (!this.mirrored) { // P1 (Top edge)
        moveRight = this.control.up    // physical Forward -> Game +X
        moveLeft  = this.control.down  // physical Backward -> Game -X
        moveUp    = this.control.left  // physical Left -> Game -Y
        moveDown  = this.control.right // physical Right -> Game +Y
      } else { // P2 (Bottom edge)
        moveRight = this.control.down  // physical Backward -> Game +X
        moveLeft  = this.control.up    // physical Forward -> Game -X
        moveUp    = this.control.right // physical Right -> Game -Y
        moveDown  = this.control.left  // physical Left -> Game +Y
      }
    }

    if (moveRight) pos.x += 5
    if (moveLeft)  pos.x -= 5
    if (moveUp)    pos.y -= 5
    if (moveDown)  pos.y += 5
    if (this.control.clockwise)        this.setAngle(angle + 0.02)
    if (this.control.counterClockwise) this.setAngle(angle - 0.02)
    const canvas = document.querySelector('#matter-canvas')
    this.setPosition({
      x: Math.min(Math.max(pos.x, 0), canvas.width),
      y: Math.min(Math.max(pos.y, 0), canvas.height - 20)
    })
  }
}
