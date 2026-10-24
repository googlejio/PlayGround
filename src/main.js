import * as THREE from 'three'
import { Sound } from './audio.js'
import { UI } from './ui.js'
import { Particles } from './particles.js'
import { World } from './world.js'
import { Player } from './player.js'
import { Game } from './game.js'
import { clamp, damp, lerp } from './assets.js'

const stage = document.getElementById('stage')
const app = document.getElementById('app')

let renderer
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', alpha: false })
} catch (error) {
  stage.innerHTML = '<div style="position:absolute;inset:0;display:grid;place-items:center;padding:32px;text-align:center;color:#fff7e8;font:800 18px/1.5 system-ui,sans-serif">This game needs WebGL.<br>Try opening it in a recent version of Chrome, Safari, or Edge.</div>'
  throw error
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.matchMedia('(pointer: coarse)').matches ? 1.8 : 2))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFShadowMap
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.02
renderer.setClearColor(0xffd9c1, 1)
stage.appendChild(renderer.domElement)

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 420)
camera.position.set(0, 4.2, 8.6)

const particles = new Particles(scene, 280)
const world = new World(scene, particles)
const player = new Player(scene, particles)
const sound = new Sound()

let game
const ui = new UI({
  onPlay: () => {
    sound.ensure()
    ui.setMuted(sound.muted)
    game.start()
    sound.click()
  },
  onAgain: () => {
    sound.ensure()
    game.start()
    sound.click()
  },
  onPause: () => {
    if (game.state === 'playing') game.pause()
  },
  onResume: () => {
    game.resume()
    sound.click()
  },
  onQuit: () => {
    game.quitToMenu()
    sound.click()
  },
  onMute: () => {
    const muted = sound.toggleMute()
    ui.setMuted(muted)
    if (!muted) {
      sound.ensure()
      sound.click()
      if (game.state === 'playing') sound.startMusic()
    }
  },
})

game = new Game({ scene, player, world, particles, sound, ui })

let aspect = window.innerWidth / window.innerHeight
let portrait = aspect < 0.95
let camDist = 9.6
let gameFov = 50
let menuFov = 46

function resize() {
  const w = window.innerWidth
  const h = window.innerHeight
  aspect = w / h
  portrait = aspect < 0.95
  camDist = portrait ? 12.2 : 9.6
  const coverage = portrait ? 4.15 : 6.4
  gameFov = portrait
    ? clamp((2 * Math.atan(coverage / (camDist * aspect)) * 180) / Math.PI, 52, 82)
    : clamp((2 * Math.atan(coverage / (camDist * aspect)) * 180) / Math.PI, 50, 84)
  menuFov = aspect < 0.8 ? 50 : 46
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.matchMedia('(pointer: coarse)').matches ? 1.8 : 2))
  renderer.setSize(w, h)
  camera.aspect = aspect
  camera.updateProjectionMatrix()
}
resize()
window.addEventListener('resize', resize)
window.addEventListener('orientationchange', () => setTimeout(resize, 120))

const look = new THREE.Vector3(0, 1.5, 0)
const desiredPos = new THREE.Vector3()
const desiredLook = new THREE.Vector3()
let elapsed = 0
let lastFrame = null

function updateCamera(dt) {
  elapsed += dt
  const t = elapsed
  const state = game.state
  const playing = state === 'playing' || state === 'dying' || state === 'over' || state === 'paused'

  if (playing) {
    const shake = game.getShake()
    const shakeX = (Math.random() - 0.5) * shake * 0.42
    const shakeY = (Math.random() - 0.5) * shake * 0.32
    desiredPos.set(
      player.x * 0.34 + shakeX,
      (portrait ? 5.1 : 4.45) + Math.sin(t * 1.25) * 0.05 + shakeY,
      camDist,
    )
    desiredLook.set(player.x * 0.22 + shakeX * 0.4, portrait ? 1.15 : 1.15, portrait ? -3.5 : -3.5)
  } else {
    const orbit = Math.sin(t * 0.26) * (portrait ? 0.45 : 0.7)
    desiredPos.set(orbit, portrait ? 4.35 : 4.05, portrait ? 9.35 : 8.05)
    desiredLook.set(orbit * 0.32, 1.62, -0.2)
  }

  const lambda = playing ? 7.5 : 4.2
  camera.position.x = damp(camera.position.x, desiredPos.x, lambda, dt)
  camera.position.y = damp(camera.position.y, desiredPos.y, lambda, dt)
  camera.position.z = damp(camera.position.z, desiredPos.z, lambda, dt)
  look.x = damp(look.x, desiredLook.x, 6, dt)
  look.y = damp(look.y, desiredLook.y, 6, dt)
  look.z = damp(look.z, desiredLook.z, 6, dt)
  camera.lookAt(look)

  const targetFov = playing ? gameFov : menuFov
  if (Math.abs(camera.fov - targetFov) > 0.01) {
    camera.fov = damp(camera.fov, targetFov, 5, dt)
    camera.updateProjectionMatrix()
  }
}

function doJump() {
  if (game.state !== 'playing') return
  const result = player.jump()
  if (result === 'jump') sound.jump()
  else if (result === 'double') sound.doubleJump()
}

const keys = { left: false, right: false }
window.addEventListener('keydown', (event) => {
  const code = event.code
  if (event.repeat) {
    if (code === 'Space' || code === 'ArrowUp' || code === 'KeyW' || code === 'ArrowLeft' || code === 'ArrowRight' || code === 'KeyA' || code === 'KeyD') event.preventDefault()
    return
  }
  if (code === 'Space' || code === 'ArrowUp' || code === 'KeyW') {
    event.preventDefault()
    doJump()
  } else if (code === 'ArrowLeft' || code === 'KeyA') {
    keys.left = true
    if (game.state === 'playing') player.targetX = clamp(player.targetX - 0.55, -3.35, 3.35)
  } else if (code === 'ArrowRight' || code === 'KeyD') {
    keys.right = true
    if (game.state === 'playing') player.targetX = clamp(player.targetX + 0.55, -3.35, 3.35)
  } else if (code === 'KeyP' || code === 'Escape') {
    if (game.state === 'playing') game.pause()
    else if (game.state === 'paused') game.resume()
  } else if (code === 'KeyM') {
    const muted = sound.toggleMute()
    ui.setMuted(muted)
    if (!muted) {
      sound.ensure()
      if (game.state === 'playing' || game.state === 'paused') sound.startMusic()
    }
  } else if (code === 'Enter' && (game.state === 'menu' || game.state === 'over')) {
    sound.ensure()
    game.start()
    sound.click()
  }
})
window.addEventListener('keyup', (event) => {
  if (event.code === 'ArrowLeft' || event.code === 'KeyA') keys.left = false
  if (event.code === 'ArrowRight' || event.code === 'KeyD') keys.right = false
})
window.addEventListener('blur', () => {
  keys.left = false
  keys.right = false
  gesture = null
})

let gesture = null
app.addEventListener('pointerdown', (event) => {
  sound.ensure()
  if (game.state !== 'playing') return
  if (event.target.closest && event.target.closest('button')) return
  gesture = {
    id: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    startTarget: player.targetX,
    moved: false,
    time: performance.now(),
  }
  if (app.setPointerCapture) {
    try { app.setPointerCapture(event.pointerId) } catch {}
  }
})

app.addEventListener('pointermove', (event) => {
  if (!gesture || event.pointerId !== gesture.id || game.state !== 'playing') return
  const dx = event.clientX - gesture.startX
  if (Math.abs(dx) > 7) gesture.moved = true
  if (gesture.moved) {
    player.targetX = clamp(gesture.startTarget + (dx / window.innerWidth) * 10.5, -3.35, 3.35)
  }
})

function endGesture(event) {
  if (!gesture || event.pointerId !== gesture.id) return
  const duration = performance.now() - gesture.time
  const wasMoved = gesture.moved
  gesture = null
  if (!wasMoved && duration < 520) doJump()
}
app.addEventListener('pointerup', endGesture)
app.addEventListener('pointercancel', (event) => {
  if (gesture && event.pointerId === gesture.id) gesture = null
})

document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.state === 'playing') game.pause()
})

function frame(now) {
  requestAnimationFrame(frame)
  if (now === undefined) now = performance.now()
  if (lastFrame === null) lastFrame = now
  const dt = Math.min(Math.max((now - lastFrame) / 1000, 0), 0.05)
  lastFrame = now
  if (document.hidden) return
  if (keys.left) player.targetX = clamp(player.targetX - dt * 7.2, -3.35, 3.35)
  if (keys.right) player.targetX = clamp(player.targetX + dt * 7.2, -3.35, 3.35)
  game.update(dt)
  updateCamera(dt)
  renderer.render(scene, camera)
}

updateCamera(1 / 60)
frame()
