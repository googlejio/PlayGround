import * as THREE from 'three'

function makeSparkTexture() {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.22, 'rgba(255,255,255,0.95)')
  g.addColorStop(0.5, 'rgba(255,255,255,0.28)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
  ctx.fill()
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

const vertexShader = `
  attribute float size;
  attribute float alpha;
  attribute vec3 tint;
  varying float vAlpha;
  varying vec3 vTint;
  void main() {
    vAlpha = alpha;
    vTint = tint;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * (320.0 / max(0.001, -mv.z));
    gl_Position = projectionMatrix * mv;
  }
`

const fragmentShader = `
  uniform sampler2D map;
  varying float vAlpha;
  varying vec3 vTint;
  void main() {
    vec4 tex = texture2D(map, gl_PointCoord);
    if (tex.a < 0.01) discard;
    gl_FragColor = vec4(vTint, vAlpha) * tex;
  }
`

export class Particles {
  constructor(scene, max = 260) {
    this.max = max
    this.cursor = 0
    this.geometry = new THREE.BufferGeometry()
    this.positions = new Float32Array(max * 3)
    this.colors = new Float32Array(max * 3)
    this.sizes = new Float32Array(max)
    this.alphas = new Float32Array(max)
    this.velocities = new Float32Array(max * 3)
    this.life = new Float32Array(max)
    this.maxLife = new Float32Array(max)
    this.drag = new Float32Array(max)
    this.gravity = new Float32Array(max)

    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
    this.geometry.setAttribute('tint', new THREE.BufferAttribute(this.colors, 3))
    this.geometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1))
    this.geometry.setAttribute('alpha', new THREE.BufferAttribute(this.alphas, 1))

    this.material = new THREE.ShaderMaterial({
      uniforms: { map: { value: makeSparkTexture() } },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

    this.points = new THREE.Points(this.geometry, this.material)
    this.points.frustumCulled = false
    this.points.renderOrder = 20
    scene.add(this.points)
  }

  emit(origin, options = {}) {
    const {
      count = 12,
      colors = [0xffffff],
      speed = 3,
      spread = 1,
      gravity = 2,
      life = 0.8,
      size = 0.34,
      drag = 1.6,
      direction = null,
    } = options
    for (let i = 0; i < count; i++) {
      const idx = this.cursor
      this.cursor = (this.cursor + 1) % this.max
      const i3 = idx * 3
      this.positions[i3] = origin.x + (Math.random() - 0.5) * 0.25
      this.positions[i3 + 1] = origin.y + (Math.random() - 0.5) * 0.25
      this.positions[i3 + 2] = origin.z + (Math.random() - 0.5) * 0.25

      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      let vx = Math.sin(phi) * Math.cos(theta)
      let vy = Math.cos(phi)
      let vz = Math.sin(phi) * Math.sin(theta)
      if (direction) {
        vx = vx * 0.5 + direction.x
        vy = vy * 0.5 + direction.y
        vz = vz * 0.5 + direction.z
        const len = Math.hypot(vx, vy, vz) || 1
        vx /= len; vy /= len; vz /= len
      }
      const s = speed * (0.45 + Math.random() * 0.75)
      this.velocities[i3] = vx * s * spread
      this.velocities[i3 + 1] = vy * s * spread
      this.velocities[i3 + 2] = vz * s * spread

      const color = new THREE.Color(colors[Math.floor(Math.random() * colors.length)])
      this.colors[i3] = color.r
      this.colors[i3 + 1] = color.g
      this.colors[i3 + 2] = color.b
      this.sizes[idx] = size * (0.55 + Math.random() * 0.9)
      this.alphas[idx] = 1
      this.maxLife[idx] = life * (0.7 + Math.random() * 0.6)
      this.life[idx] = this.maxLife[idx]
      this.drag[idx] = drag
      this.gravity[idx] = gravity
    }
    this.dirty = true
  }

  update(dt) {
    let dirty = Boolean(this.dirty)
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue
      dirty = true
      this.life[i] -= dt
      const i3 = i * 3
      if (this.life[i] <= 0) {
        this.alphas[i] = 0
        this.sizes[i] = 0
        continue
      }
      const damping = Math.max(0, 1 - this.drag[i] * dt)
      this.velocities[i3] *= damping
      this.velocities[i3 + 1] = this.velocities[i3 + 1] * damping - this.gravity[i] * dt
      this.velocities[i3 + 2] *= damping
      this.positions[i3] += this.velocities[i3] * dt
      this.positions[i3 + 1] += this.velocities[i3 + 1] * dt
      this.positions[i3 + 2] += this.velocities[i3 + 2] * dt
      const t = this.life[i] / this.maxLife[i]
      this.alphas[i] = Math.min(1, t * 1.8)
      this.sizes[i] *= 0.995
    }
    if (dirty) {
      this.geometry.attributes.position.needsUpdate = true
      this.geometry.attributes.tint.needsUpdate = true
      this.geometry.attributes.size.needsUpdate = true
      this.geometry.attributes.alpha.needsUpdate = true
      this.dirty = false
    }
  }

  clear() {
    this.life.fill(0)
    this.alphas.fill(0)
    this.sizes.fill(0)
    this.geometry.attributes.size.needsUpdate = true
    this.geometry.attributes.alpha.needsUpdate = true
  }
}
