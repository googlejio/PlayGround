import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { letterTexture, heartTexture, glowTexture, shadowTexture, makeSprite, clamp } from './assets.js'

let shared = null

function getShared() {
  if (shared) return shared
  const puffParts = []
  const puffPositions = [
    [-0.7, 0.12, 0, 0.62],
    [0.0, 0.34, 0.02, 0.78],
    [0.72, 0.1, -0.03, 0.58],
    [-0.25, -0.14, 0.1, 0.56],
    [0.4, -0.16, 0.08, 0.5],
  ]
  for (const [x, y, z, s] of puffPositions) {
    const geo = new THREE.SphereGeometry(1, 10, 8)
    geo.scale(s, s * 0.88, s * 1.03)
    geo.translate(x, y, z)
    puffParts.push(geo)
  }
  shared = {
    cloudGeo: mergeGeometries(puffParts),
    cloudMat: new THREE.MeshStandardMaterial({
      color: 0x4a3468,
      roughness: 0.9,
      metalness: 0.05,
      emissive: 0x5d2f88,
      emissiveIntensity: 0.35,
      flatShading: true,
    }),
    cloudEyeMat: new THREE.MeshBasicMaterial({ color: 0xffd4e4 }),
    cloudPupilMat: new THREE.MeshBasicMaterial({ color: 0x352050 }),
    spikeGeo: new THREE.ConeGeometry(0.16, 0.75, 5),
    spikeMat: new THREE.MeshStandardMaterial({ color: 0x392754, roughness: 0.8, emissive: 0x5a2d82, emissiveIntensity: 0.3 }),
    puddleMat: new THREE.MeshStandardMaterial({
      color: 0x3a2856,
      roughness: 0.35,
      metalness: 0.2,
      emissive: 0x6b3aa5,
      emissiveIntensity: 0.7,
    }),
    puddleRimMat: new THREE.MeshBasicMaterial({ color: 0xb98aff, transparent: true, opacity: 0.75 }),
    puddleEyeMat: new THREE.MeshBasicMaterial({ color: 0xffe0f0 }),
    glowTex: glowTexture('#ffffff'),
    shadowTex: shadowTexture(),
    shadowMat: new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false, opacity: 0.4 }),
    heartTex: heartTexture('#ff5f83'),
    letterMats: new Map(),
    ringGeos: {
      large: new THREE.TorusGeometry(0.58, 0.032, 8, 40),
      small: new THREE.TorusGeometry(0.46, 0.02, 8, 32),
    },
  }
  return shared
}

let idCounter = 0

export class Pickup {
  constructor(scene, { type, x, y, z, index = 0, color = '#ff7d99', light = '#ffd0da' }) {
    const s = getShared()
    this.id = idCounter++
    this.type = type
    this.scene = scene
    this.x = x
    this.z = z
    this.baseY = y
    this.y = y
    this.radius = type === 'letter' ? 0.98 : 0.9
    this.dead = false
    this.phase = Math.random() * Math.PI * 2
    this.group = new THREE.Group()
    this.group.position.set(x, y, z)
    this.letter = null
    this.index = index

    if (type === 'letter') {
      const letter = ['H', 'E', 'L', 'L', 'O'][index]
      this.letter = letter
      const tex = letterTexture(letter, color, light)
      const halo = makeSprite(s.glowTex, { color: new THREE.Color(color), scale: 2.45, opacity: 0.36 })
      halo.position.z = -0.05
      this.group.add(halo)

      const main = makeSprite(tex, { scale: 1.4, opacity: 1, additive: false })
      main.position.z = 0.02
      this.group.add(main)

      const ringMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(light),
        emissive: new THREE.Color(color),
        emissiveIntensity: 1.8,
        roughness: 0.25,
        metalness: 0.2,
      })
      const ring = new THREE.Mesh(s.ringGeos.large, ringMat)
      ring.position.z = -0.04
      const ring2 = new THREE.Mesh(s.ringGeos.small, ringMat)
      ring2.rotation.y = Math.PI / 2
      ring2.position.z = -0.04
      this.group.add(ring, ring2)
      this.ring = ring
      this.ring2 = ring2
      this.sprite = main

      if (y > 2) {
        const markerMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(color),
          transparent: true,
          opacity: 0.45,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
        })
        const marker = new THREE.Mesh(new THREE.RingGeometry(0.38, 0.55, 32), markerMat)
        marker.rotation.x = -Math.PI / 2
        marker.position.y = -y + 0.03
        this.group.add(marker)
        this.marker = marker
        const beam = new THREE.Mesh(
          new THREE.CylinderGeometry(0.35, 0.35, y - 0.05, 20, 1, true),
          new THREE.MeshBasicMaterial({
            color: new THREE.Color(color),
            transparent: true,
            opacity: 0.06,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
          }),
        )
        beam.position.y = -y / 2
        this.group.add(beam)
      }
    } else {
      const halo = makeSprite(s.glowTex, { color: 0xff5f83, scale: 2.5, opacity: 0.5 })
      this.group.add(halo)
      const sprite = makeSprite(s.heartTex, { scale: 1.42, opacity: 1, additive: false })
      sprite.position.z = 0.02
      this.group.add(sprite)
      this.sprite = sprite
      this.halo = halo
    }

    scene.add(this.group)
  }

  update(dt, t) {
    if (this.type === 'letter') {
      this.group.position.y = this.baseY + Math.sin(t * 2.2 + this.phase) * 0.15
      this.ring.rotation.z += dt * 1.5
      this.ring2.rotation.z -= dt * 1.9
      this.ring2.rotation.x += dt * 0.7
      const pulse = 1 + Math.sin(t * 3 + this.phase) * 0.035
      this.sprite.scale.set(1.4 * pulse, 1.4 * pulse, 1)
      if (this.marker) {
        const s = 1 + Math.sin(t * 4 + this.phase) * 0.14
        this.marker.scale.set(s, s, s)
        this.marker.material.opacity = 0.35 + Math.sin(t * 4 + this.phase) * 0.15
      }
    } else {
      this.group.position.y = this.baseY + Math.sin(t * 2.6 + this.phase) * 0.14
      const pulse = 1 + Math.sin(t * 4 + this.phase) * 0.07
      this.sprite.scale.set(1.42 * pulse, 1.42 * pulse, 1)
      this.halo.material.opacity = 0.4 + Math.sin(t * 4 + this.phase) * 0.14
      this.group.rotation.z = Math.sin(t * 1.8 + this.phase) * 0.09
    }
  }

  destroy() {
    this.dead = true
    this.scene.remove(this.group)
    this.group.traverse((obj) => {
      if (obj.material) obj.material.dispose()
      if (obj.geometry && obj.geometry.userData.unique) obj.geometry.dispose()
    })
  }
}

export class CloudObstacle {
  constructor(scene, { x, z }) {
    const s = getShared()
    this.type = 'cloud'
    this.id = idCounter++
    this.scene = scene
    this.x = x
    this.z = z
    this.baseY = 1.55
    this.y = 1.55
    this.radius = 1.02
    this.dead = false
    this.phase = Math.random() * Math.PI * 2
    this.spin = (Math.random() - 0.5) * 0.5
    this.group = new THREE.Group()
    this.group.position.set(x, this.baseY, z)
    this.group.scale.setScalar(0.95 + Math.random() * 0.2)
    this.group.rotation.y = (Math.random() - 0.5) * 0.4

    const halo = makeSprite(s.glowTex, { color: 0x8b5fb0, scale: 2.9, opacity: 0.22 })
    halo.position.z = -0.5
    this.group.add(halo)

    const body = new THREE.Mesh(s.cloudGeo, s.cloudMat)
    body.castShadow = true
    this.group.add(body)

    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 2.7), s.shadowMat)
    shadow.rotation.x = -Math.PI / 2
    shadow.position.y = -this.baseY + 0.03
    shadow.renderOrder = 1
    this.group.add(shadow)

    const eyeGeo = new THREE.SphereGeometry(0.135, 12, 10)
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(eyeGeo, s.cloudEyeMat)
      eye.scale.set(1, 1.18, 0.55)
      eye.position.set(side * 0.31, 0.2, 0.66)
      eye.rotation.z = side * -0.12
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.058, 8, 8), s.cloudPupilMat)
      pupil.position.set(side * 0.29, 0.19, 0.74)
      pupil.scale.z = 0.5
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.045, 0.045), s.spikeMat)
      brow.position.set(side * 0.31, 0.42, 0.66)
      brow.rotation.z = side * 0.32
      this.group.add(eye, pupil, brow)
    }

    for (let i = 0; i < 3; i++) {
      const spike = new THREE.Mesh(s.spikeGeo, s.spikeMat)
      spike.position.set((i - 1) * 0.38, -0.72 - Math.abs(i - 1) * 0.1, 0.05)
      spike.rotation.x = Math.PI
      spike.rotation.z = (i - 1) * 0.18
      this.group.add(spike)
    }

    scene.add(this.group)
  }

  update(dt, t) {
    this.group.position.y = this.baseY + Math.sin(t * 2.1 + this.phase) * 0.16
    this.group.rotation.z = Math.sin(t * 1.4 + this.phase) * 0.07
    this.group.rotation.y += this.spin * dt
  }

  destroy() {
    this.dead = true
    this.scene.remove(this.group)
  }
}

export class Puddle {
  constructor(scene, { x, z }) {
    const s = getShared()
    this.type = 'puddle'
    this.id = idCounter++
    this.scene = scene
    this.x = x
    this.z = z
    this.y = 0.1
    this.baseY = 0.1
    this.radius = 1.05
    this.dead = false
    this.phase = Math.random() * Math.PI * 2
    this.group = new THREE.Group()
    this.group.position.set(x, 0, z)

    const halo = makeSprite(s.glowTex, { color: 0x9a65e8, scale: 3.2, opacity: 0.32 })
    halo.position.y = 0.38
    this.group.add(halo)

    const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.02, 0.86, 0.16, 24), s.puddleMat)
    disc.position.y = 0.09
    disc.receiveShadow = true
    this.group.add(disc)

    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.94, 0.035, 8, 40), s.puddleRimMat)
    rim.rotation.x = Math.PI / 2
    rim.position.y = 0.18
    this.group.add(rim)
    this.rim = rim

    const ripple = new THREE.Mesh(
      new THREE.TorusGeometry(0.62, 0.018, 6, 32),
      new THREE.MeshBasicMaterial({ color: 0xd0a6ff, transparent: true, opacity: 0.5, depthWrite: false }),
    )
    ripple.rotation.x = Math.PI / 2
    ripple.position.y = 0.2
    this.group.add(ripple)
    this.ripple = ripple

    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), s.puddleEyeMat)
      eye.position.set(side * 0.34, 0.28, 0.58)
      eye.scale.set(1, 1.1, 0.6)
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.04, 0.04), s.spikeMat)
      brow.position.set(side * 0.34, 0.46, 0.56)
      brow.rotation.z = side * 0.3
      this.group.add(eye, brow)
    }

    scene.add(this.group)
  }

  update(dt, t) {
    const s = 1 + Math.sin(t * 3.4 + this.phase) * 0.05
    this.rim.scale.set(s, s, 1)
    const rs = 0.85 + (Math.sin(t * 2 + this.phase) * 0.5 + 0.5) * 0.5
    this.ripple.scale.set(rs, rs, 1)
    this.ripple.material.opacity = 0.2 + (1 - rs + 0.15) * 0.3
  }

  destroy() {
    this.dead = true
    this.scene.remove(this.group)
  }
}
