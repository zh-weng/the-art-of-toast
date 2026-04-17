import {Bodies, Body, Composite} from 'matter-js'

// Difficulty configs: wallAngleDeg controls how splayed the cup walls are (harder = more splayed),
// particles controls how much liquid each cup starts with.
export const DIFFICULTY_CONFIGS = {
  easy:   { wallAngleDeg: 8,  particles: 120 },
  normal: { wallAngleDeg: 15, particles: 100 },
  hard:   { wallAngleDeg: 22, particles: 80  },
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

  // Builds the CSS transform string. Uses live innerWidth/innerHeight so resize works correctly.
  _makeTransform = (comX, comY, angleDeg) => {
    const tx = comX - innerWidth / 2
    const ty = comY - innerHeight / 2
    const mirror = this.mirrored ? ' scaleX(-1)' : ''
    return `translate(${tx}px, ${ty}px) rotate(${angleDeg}deg) translate(${this.xCorrection}px, -25px)${mirror}`
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
    if (this.control.right) pos.x += 5
    if (this.control.left)  pos.x -= 5
    if (this.control.up)    pos.y -= 5
    if (this.control.down)  pos.y += 5
    if (this.control.clockwise)        this.setAngle(angle + 0.02)
    if (this.control.counterClockwise) this.setAngle(angle - 0.02)
    this.setPosition({
      x: Math.min(Math.max(pos.x, 0), innerWidth),
      y: Math.min(Math.max(pos.y, 0), innerHeight - 20)
    })
  }
}
