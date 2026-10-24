import * as THREE from 'three'

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
export const lerp = (a, b, t) => a + (b - a) * t
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt))
export const rand = (a, b) => a + Math.random() * (b - a)
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]

function canvas(size = 256) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  return [c, c.getContext('2d')]
}

function texture(c) {
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

export function glowTexture(inner = '#ffffff', outer = 'rgba(255,255,255,0)') {
  const [c, ctx] = canvas(128)
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, inner)
  g.addColorStop(0.35, inner)
  g.addColorStop(1, outer)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  return texture(c)
}

export function shadowTexture() {
  const [c, ctx] = canvas(128)
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62)
  g.addColorStop(0, 'rgba(49, 26, 72, 0.5)')
  g.addColorStop(0.55, 'rgba(49, 26, 72, 0.25)')
  g.addColorStop(1, 'rgba(49, 26, 72, 0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  return texture(c)
}

export function starTexture() {
  const [c, ctx] = canvas(128)
  ctx.translate(64, 64)
  ctx.fillStyle = '#ffffff'
  ctx.shadowColor = '#ffffff'
  ctx.shadowBlur = 18
  for (let i = 0; i < 4; i++) {
    ctx.rotate(Math.PI / 2)
    ctx.beginPath()
    ctx.moveTo(0, -58)
    ctx.quadraticCurveTo(9, -9, 58, 0)
    ctx.quadraticCurveTo(9, 9, 0, 58)
    ctx.quadraticCurveTo(-9, 9, -58, 0)
    ctx.quadraticCurveTo(-9, -9, 0, -58)
    ctx.fill()
  }
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 62)
  g.addColorStop(0, 'rgba(255,255,255,0.95)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(0, 0, 62, 0, Math.PI * 2)
  ctx.fill()
  return texture(c)
}

const letterCache = new Map()

export function letterTexture(letter, color, light) {
  const key = letter + color
  if (letterCache.has(key)) return letterCache.get(key)
  const [c, ctx] = canvas(256)
  const cx = 128

  const halo = ctx.createRadialGradient(cx, cx, 20, cx, cx, 126)
  halo.addColorStop(0, `${color}cc`)
  halo.addColorStop(0.45, `${color}55`)
  halo.addColorStop(1, `${color}00`)
  ctx.fillStyle = halo
  ctx.fillRect(0, 0, 256, 256)

  const circle = ctx.createRadialGradient(cx - 32, cx - 40, 8, cx, cx, 100)
  circle.addColorStop(0, light)
  circle.addColorStop(0.55, color)
  circle.addColorStop(1, color)
  ctx.fillStyle = circle
  ctx.beginPath()
  ctx.arc(cx, cx, 92, 0, Math.PI * 2)
  ctx.fill()

  ctx.lineWidth = 8
  ctx.strokeStyle = 'rgba(255,255,255,0.72)'
  ctx.beginPath()
  ctx.arc(cx, cx, 92, 0, Math.PI * 2)
  ctx.stroke()

  ctx.lineWidth = 4
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'
  ctx.beginPath()
  ctx.arc(cx, cx, 78, 0, Math.PI * 2)
  ctx.stroke()

  ctx.font = '900 118px ui-rounded, "Arial Rounded MT Bold", "Trebuchet MS", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(73, 33, 82, 0.28)'
  ctx.fillText(letter, cx + 3, cx + 12)
  ctx.fillStyle = '#ffffff'
  ctx.fillText(letter, cx, cx + 6)

  const t = texture(c)
  letterCache.set(key, t)
  return t
}

const heartCache = new Map()

export function heartTexture(color = '#ff5f83') {
  if (heartCache.has(color)) return heartCache.get(color)
  const [c, ctx] = canvas(256)
  const cx = 128
  const halo = ctx.createRadialGradient(cx, cx, 10, cx, cx, 126)
  halo.addColorStop(0, `${color}bb`)
  halo.addColorStop(0.55, `${color}33`)
  halo.addColorStop(1, `${color}00`)
  ctx.fillStyle = halo
  ctx.fillRect(0, 0, 256, 256)
  ctx.translate(cx, cx + 10)
  ctx.scale(1.05, 1.05)
  const drawHeart = (scale) => {
    ctx.beginPath()
    ctx.moveTo(0, 52)
    ctx.bezierCurveTo(-88, -6, -56, -78, 0, -38)
    ctx.bezierCurveTo(56, -78, 88, -6, 0, 52)
    ctx.closePath()
  }
  ctx.shadowColor = 'rgba(120, 20, 60, 0.45)'
  ctx.shadowBlur = 18
  ctx.shadowOffsetY = 8
  drawHeart()
  const grad = ctx.createLinearGradient(0, -70, 0, 60)
  grad.addColorStop(0, '#ffb3c4')
  grad.addColorStop(0.5, color)
  grad.addColorStop(1, '#e2466f')
  ctx.fillStyle = grad
  ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.lineWidth = 7
  ctx.strokeStyle = 'rgba(255,255,255,0.75)'
  ctx.stroke()
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.beginPath()
  ctx.ellipse(-28, -30, 16, 10, -0.6, 0, Math.PI * 2)
  ctx.fill()
  const t = texture(c)
  heartCache.set(color, t)
  return t
}

export function makeSprite(map, { color = 0xffffff, scale = 1, opacity = 1, additive = true, depthTest = true } = {}) {
  const mat = new THREE.SpriteMaterial({
    map,
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    depthTest,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  })
  const sprite = new THREE.Sprite(mat)
  sprite.scale.set(scale, scale, 1)
  return sprite
}

export function deckTexture() {
  const [c, ctx] = canvas(512)
  const base = ctx.createLinearGradient(0, 0, 0, 512)
  base.addColorStop(0, '#fffaf1')
  base.addColorStop(0.55, '#fff5e5')
  base.addColorStop(1, '#ffeeda')
  ctx.fillStyle = base
  ctx.fillRect(0, 0, 512, 512)

  for (let i = 0; i < 1800; i++) {
    const warm = Math.random()
    ctx.fillStyle = warm > 0.5 ? 'rgba(206, 154, 132, 0.05)' : 'rgba(255, 255, 255, 0.08)'
    const r = Math.random() * 2.2 + 0.4
    ctx.beginPath()
    ctx.arc(Math.random() * 512, Math.random() * 512, r, 0, Math.PI * 2)
    ctx.fill()
  }

  const starColors = ['rgba(255, 158, 180, 0.34)', 'rgba(124, 231, 208, 0.3)', 'rgba(255, 205, 126, 0.34)', 'rgba(168, 196, 255, 0.28)']
  for (let i = 0; i < 46; i++) {
    const x = Math.random() * 512
    const y = Math.random() * 512
    const s = 3 + Math.random() * 7
    ctx.save()
    ctx.translate(x, y)
    ctx.fillStyle = starColors[Math.floor(Math.random() * starColors.length)]
    ctx.beginPath()
    ctx.moveTo(0, -s)
    ctx.quadraticCurveTo(s * 0.18, -s * 0.18, s, 0)
    ctx.quadraticCurveTo(s * 0.18, s * 0.18, 0, s)
    ctx.quadraticCurveTo(-s * 0.18, s * 0.18, -s, 0)
    ctx.quadraticCurveTo(-s * 0.18, -s * 0.18, 0, -s)
    ctx.fill()
    ctx.restore()
  }

  ctx.strokeStyle = 'rgba(190, 143, 128, 0.16)'
  ctx.lineWidth = 5
  ctx.beginPath()
  const inset = 13
  const radius = 26
  ctx.roundRect(inset, inset, 512 - inset * 2, 512 - inset * 2, radius)
  ctx.stroke()

  const tex = texture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.anisotropy = 8
  return tex
}

export function makeRingGradient() {
  const [c, ctx] = canvas(256)
  const g = ctx.createRadialGradient(128, 128, 48, 128, 128, 120)
  g.addColorStop(0, 'rgba(255,255,255,0)')
  g.addColorStop(0.72, 'rgba(255,255,255,0)')
  g.addColorStop(0.82, 'rgba(255,255,255,0.9)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 256, 256)
  return texture(c)
}
