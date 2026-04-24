const VERT_SRC = `
  attribute vec2 aPosition;
  void main() {
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }
`

// MAX_PARTICLES covers both players combined: easy=120+120=240, so 256 gives headroom.
// Increase this constant (and nothing else) to upgrade capacity.
const MAX_PARTICLES = 256

const FRAG_SRC = `
  precision highp float;
  uniform vec2  uParticles[${MAX_PARTICLES}];
  uniform int   uCount;
  uniform float uRadius;
  uniform float uThreshold;
  uniform vec4  uColor;
  uniform vec2  uResolution;

  void main() {
    vec2 fragCoord = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y);
    float field = 0.0;
    for (int i = 0; i < ${MAX_PARTICLES}; i++) {
      if (i >= uCount) break;
      vec2 delta = uParticles[i] - fragCoord;
      float d2 = dot(delta, delta);
      if (d2 > 0.0) field += (uRadius * uRadius) / d2;
    }
    if (field < uThreshold) discard;
    gl_FragColor = uColor;
  }
`

function compileShader(gl, type, src) {
  const shader = gl.createShader(type)
  gl.shaderSource(shader, src)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error('Shader compile error: ' + gl.getShaderInfoLog(shader))
  }
  return shader
}

function createProgram(gl) {
  const prog = gl.createProgram()
  gl.attachShader(prog, compileShader(gl, gl.VERTEX_SHADER,   VERT_SRC))
  gl.attachShader(prog, compileShader(gl, gl.FRAGMENT_SHADER, FRAG_SRC))
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error('Program link error: ' + gl.getProgramInfoLog(prog))
  }
  return prog
}

// ParticleUploader: Phase A — uniform array upload.
// Phase B upgrade: replace this class with one that writes positions into a
// float texture and reads it in the shader; the LiquidRenderer interface is unchanged.
class ParticleUploader {
  constructor(gl, prog) {
    this.gl   = gl
    this.locs = []
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.locs.push(gl.getUniformLocation(prog, `uParticles[${i}]`))
    }
    this.countLoc = gl.getUniformLocation(prog, 'uCount')
  }

  upload(particles, scale) {
    const { gl, locs, countLoc } = this
    const count = Math.min(particles.length, MAX_PARTICLES)
    gl.uniform1i(countLoc, count)
    for (let i = 0; i < count; i++) {
      gl.uniform2f(locs[i], particles[i].position.x * scale, particles[i].position.y * scale)
    }
  }
}

export class LiquidRenderer {
  // color: [r, g, b, a] each in 0–1 range
  constructor(color) {
    this.canvas = document.getElementById('webgl-canvas')
    const gl = this.canvas.getContext('webgl')
    if (!gl) throw new Error('WebGL not supported')
    this.gl = gl

    const prog = createProgram(gl)
    gl.useProgram(prog)

    // Full-screen quad — two triangles covering clip space
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,  1, -1,  -1, 1,
      -1,  1,  1, -1,   1, 1,
    ]), gl.STATIC_DRAW)
    const posLoc = gl.getAttribLocation(prog, 'aPosition')
    gl.enableVertexAttribArray(posLoc)
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)

    this.uploader    = new ParticleUploader(gl, prog)
    this.uResolution = gl.getUniformLocation(prog, 'uResolution')
    this.uRadius     = gl.getUniformLocation(prog, 'uRadius')
    this.uThreshold  = gl.getUniformLocation(prog, 'uThreshold')
    this.uColor      = gl.getUniformLocation(prog, 'uColor')

    // Apple GPU composits WebGL canvases through the CPU, severely degrading frame rate.
    // Check WEBGL_debug_renderer_info for an Apple renderer string first;
    // fall back to UA-based Safari detection when the extension isn't available.
    // (iOS Chrome/CriOS uses the same WebKit stack and benefits from half-res too.)
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
    const renderer  = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : ''
    const isSafari  = /apple/i.test(renderer) || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
    this._renderScale = isSafari ? 0.5 : 1.0

    gl.uniform1f(this.uRadius,    4.5 * this._renderScale)
    gl.uniform1f(this.uThreshold, 0.8)
    gl.uniform4f(this.uColor, color[0], color[1], color[2], color[3])

    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

    this.resize()
  }

  resize() {
    const { gl, canvas } = this
    const scale = this._renderScale
    canvas.width  = Math.round(innerWidth  * scale)
    canvas.height = Math.round(innerHeight * scale)
    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.uniform2f(this.uResolution, canvas.width, canvas.height)
  }

  destroy() {
    this.gl.getExtension('WEBGL_lose_context')?.loseContext()
  }

  // circles0 and circles1 are Matter.js Body arrays
  render(circles0, circles1) {
    const { gl } = this
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    const all = circles0.concat(circles1)
    this.uploader.upload(all, this._renderScale)
    gl.drawArrays(gl.TRIANGLES, 0, 6)
  }
}
