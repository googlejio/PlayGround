import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { glowTexture, shadowTexture, clamp, damp, lerp } from './assets.js'

const CREAM = 0xfff4e2
const CREAM_DARK = 0xffe3c8
const INK = 0x342a4f
const CORAL = 0xff6f8f
const CYAN = 0x8ff8ff
const GOLD = 0xffd166

export class Player {
  constructor(scene, particles) {
    this.scene = scene
    this.particles = particles
    this.root = new THREE.Group()
    this.model = new THREE.Group()
    this.root.add(this.model)
    scene.add(this.root)
    this.root.scale.setScalar(1.12)

    this.x = 0
    this.targetX = 0
    this.y = 0
    this.vy = 0
    this.onGround = true
    this.airJumps = 1
    this.invuln = 0
    this.celebrate = 0
    this.time = 0
    this.thrusterTimer = 0
    this.trailTimer = 0
    this.landSquash = 0

    this.bodyMat = new THREE.MeshStandardMaterial({ color: CREAM, roughness: 0.55, metalness: 0.05 })
    this.bodyDarkMat = new THREE.MeshStandardMaterial({ color: CREAM_DARK, roughness: 0.7, metalness: 0.03 })
    this.visorMat = new THREE.MeshStandardMaterial({
      color: INK,
      roughness: 0.18,
      metalness: 0.45,
      emissive: 0x5a4a8f,
      emissiveIntensity: 0.22,
    })
    this.coralMat = new THREE.MeshStandardMaterial({ color: CORAL, roughness: 0.45, emissive: 0x6b1f38, emissiveIntensity: 0.18 })
    this.eyeMat = new THREE.MeshBasicMaterial({ color: CYAN })
    this.goldMat = new THREE.MeshBasicMaterial({ color: GOLD })
    this.cyanMat = new THREE.MeshBasicMaterial({ color: 0x7ceeee })

    this.glow = glowTexture('#ffffff')
    this.buildBody()
    this.buildShadow()

    this.eyeGlowL = this.makeGlow(0x9ffcff, 0.26, 0.3)
    this.eyeGlowR = this.makeGlow(0x9ffcff, 0.26, 0.3)
    this.eyeGlowL.position.set(-0.18, 0.23, -0.72)
    this.eyeGlowR.position.set(0.18, 0.23, -0.72)
    this.model.add(this.eyeGlowL, this.eyeGlowR)

    this.hoverGlow = this.makeGlow(0x8ff8ff, 1.15, 0.32)
    this.hoverGlow.position.set(0, -0.78, 0)
    this.model.add(this.hoverGlow)
  }

  makeGlow(color, scale, opacity = 1) {
    const mat = new THREE.SpriteMaterial({
      map: this.glow,
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    const s = new THREE.Sprite(mat)
    s.scale.set(scale, scale, 1)
    return s
  }

  buildBody() {
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.56, 32, 24), this.bodyMat)
    body.scale.set(1, 1.04, 0.94)
    body.position.y = 0.16
    body.castShadow = true
    this.model.add(body)

    const visor = new THREE.Mesh(new THREE.SphereGeometry(0.46, 32, 24), this.visorMat)
    visor.scale.set(0.82, 0.74, 0.46)
    visor.position.set(0, 0.22, -0.37)
    this.model.add(visor)

    const visorRim = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.024, 8, 32), this.bodyDarkMat)
    visorRim.scale.set(1.16, 0.95, 1)
    visorRim.position.set(0, 0.22, -0.575)
    this.model.add(visorRim)

    const eyeGeo = new THREE.SphereGeometry(0.078, 16, 12)
    const eyeL = new THREE.Mesh(eyeGeo, this.eyeMat)
    eyeL.position.set(-0.155, 0.27, -0.625)
    eyeL.scale.set(1, 1, 0.4)
    const eyeR = eyeL.clone()
    eyeR.position.x = 0.155
    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.012, 6, 16, Math.PI), this.eyeMat)
    smile.rotation.z = Math.PI
    smile.position.set(0, 0.1, -0.63)
    smile.scale.set(1.25, 0.75, 1)
    this.model.add(eyeL, eyeR, smile)
    this.eyes = [eyeL, eyeR]

    const cheekGeo = new THREE.SphereGeometry(0.055, 12, 10)
    const cheekMat = new THREE.MeshBasicMaterial({ color: 0xffa6b8, transparent: true, opacity: 0.85 })
    const cheekL = new THREE.Mesh(cheekGeo, cheekMat)
    cheekL.scale.set(1.5, 0.8, 0.4)
    cheekL.position.set(-0.33, 0.06, -0.52)
    const cheekR = cheekL.clone()
    cheekR.position.x = 0.33
    this.model.add(cheekL, cheekR)

    const antenna = new THREE.Group()
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.025, 0.34, 8), this.bodyDarkMat)
    stem.position.y = 0.17
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.085, 16, 12), this.goldMat)
    bulb.position.y = 0.38
    const bulbGlow = this.makeGlow(0xffd166, 0.3, 0.55)
    bulbGlow.position.y = 0.38
    antenna.add(stem, bulb, bulbGlow)
    antenna.position.set(0.12, 0.63, 0.05)
    antenna.rotation.z = -0.18
    this.model.add(antenna)
    this.antenna = antenna

    this.armL = this.makeArm(-1)
    this.armR = this.makeArm(1)
    this.model.add(this.armL.pivot, this.armR.pivot)

    this.hoverRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.34, 0.042, 8, 32),
      new THREE.MeshStandardMaterial({ color: 0x5ee9ee, emissive: 0x3cd6e0, emissiveIntensity: 2.4, roughness: 0.3 }),
    )
    this.hoverRing.rotation.x = Math.PI / 2
    this.hoverRing.position.y = -0.63
    this.model.add(this.hoverRing)

    const packMat = new THREE.MeshStandardMaterial({ color: 0x7fe3d0, roughness: 0.5, metalness: 0.05 })
    const pack = new THREE.Mesh(new RoundedBoxGeometry(0.46, 0.44, 0.2, 3, 0.08), packMat)
    pack.position.set(0, 0.14, 0.5)
    pack.castShadow = true
    const packLight = new THREE.Mesh(new THREE.CircleGeometry(0.075, 16), new THREE.MeshBasicMaterial({ color: 0xffd166 }))
    packLight.position.set(0, 0.19, 0.61)
    this.model.add(pack, packLight)
    const nozzleMat = new THREE.MeshStandardMaterial({ color: 0xffb3a7, roughness: 0.45 })
    for (const side of [-1, 1]) {
      const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 0.16, 10), nozzleMat)
      nozzle.position.set(side * 0.14, -0.09, 0.52)
      const flame = this.makeGlow(0x8ff8ff, 0.45, 0.7)
      flame.position.set(side * 0.14, -0.2, 0.54)
      this.model.add(nozzle, flame)
    }

    this.buildScarf()
  }

  makeArm(side) {
    const pivot = new THREE.Group()
    pivot.position.set(side * 0.55, 0.2, 0)
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.068, 0.24, 6, 12), this.bodyMat)
    arm.position.y = -0.18
    arm.castShadow = true
    const mitten = new THREE.Mesh(new THREE.SphereGeometry(0.095, 14, 12), this.coralMat)
    mitten.position.y = -0.38
    pivot.add(arm, mitten)
    pivot.rotation.z = side * -0.32
    return { pivot, side }
  }

  buildScarf() {
    this.scarf = []
    const group = new THREE.Group()
    group.position.set(0.15, 0.33, 0.32)
    group.rotation.set(-0.16, 0, -0.12)
    this.model.add(group)
    for (let i = 0; i < 6; i++) {
      const t = i / 5
      const color = new THREE.Color(0xff8fa3).lerp(new THREE.Color(0xffd3a3), t)
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.65, emissive: color.clone().multiplyScalar(0.12) })
      const seg = new THREE.Mesh(new RoundedBoxGeometry(0.18 - t * 0.09, 0.045, 0.155 - t * 0.04, 2, 0.022), mat)
      seg.position.set(i * 0.085, 0, i * 0.14)
      seg.castShadow = i < 2
      group.add(seg)
      this.scarf.push(seg)
    }
    this.scarfGroup = group
  }

  buildShadow() {
    const mat = new THREE.MeshBasicMaterial({
      map: shadowTexture(),
      transparent: true,
      depthWrite: false,
      opacity: 0.75,
    })
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 2.3), mat)
    this.shadow.rotation.x = -Math.PI / 2
    this.shadow.position.set(0, 0.025, 0.1)
    this.shadow.renderOrder = 2
    this.scene.add(this.shadow)
    this.model.rotation.y = Math.PI
  }

  jump() {
    if (this.onGround) {
      this.vy = 8.7
      this.onGround = false
      this.airJumps = 1
      this.landSquash = 0
      this.spawnJumpBurst(0x9ffcff, 8)
      return 'jump'
    }
    if (this.airJumps > 0) {
      this.airJumps -= 1
      this.vy = 7.6
      this.spawnJumpBurst(0xffd166, 12)
      return 'double'
    }
    return null
  }

  spawnJumpBurst(color, count) {
    const pos = new THREE.Vector3(this.x, this.root.position.y + 0.1, 0.2)
    this.particles.emit(pos, {
      count,
      colors: [color, 0xffffff],
      speed: 2.6,
      spread: 1,
      gravity: 3.2,
      life: 0.55,
      size: 0.28,
      drag: 2.4,
      direction: new THREE.Vector3(0, -0.35, 0.4),
    })
  }

  hurt() {
    if (this.invuln > 0) return false
    this.invuln = 1.5
    this.celebrate = 0
    this.vy = Math.max(this.vy, 3.2)
    this.onGround = false
    this.landSquash = 0
    return true
  }

  celebrateNow() {
    this.celebrate = 2.4
  }

  reset() {
    this.x = 0
    this.targetX = 0
    this.y = 0
    this.vy = 0
    this.onGround = true
    this.airJumps = 1
    this.invuln = 0
    this.celebrate = 0
    this.landSquash = 0
    this.root.position.set(0, 0, 0)
    this.root.rotation.set(0, 0, 0)
    this.model.visible = true
    this.model.scale.set(1, 1, 1)
    this.model.rotation.y = Math.PI
    this.scarfGroup.rotation.set(-0.16, 0, -0.12)
  }

  update(dt, mode, speed = 0) {
    this.time += dt
    const t = this.time
    const playing = mode === 'playing'

    this.x = damp(this.x, this.targetX, playing ? 13 : 5, dt)

    if (playing) {
      if (!this.onGround) {
        this.vy -= 26 * dt
        this.y += this.vy * dt
        if (this.y <= 0) {
          this.y = 0
          this.vy = 0
          this.onGround = true
          this.landSquash = 1
          this.particles.emit(new THREE.Vector3(this.x, 0.15, 0.15), {
            count: 10,
            colors: [0xfff3dc, 0xffb7c4, 0xffffff],
            speed: 2.2,
            spread: 1.4,
            gravity: 3,
            life: 0.5,
            size: 0.3,
            drag: 3,
            direction: new THREE.Vector3(0, 0.25, 0.2),
          })
        }
      }
      this.invuln = Math.max(0, this.invuln - dt)
    } else {
      this.y = 0
      this.vy = 0
      this.onGround = true
      this.invuln = Math.max(0, this.invuln - dt)
    }
    this.celebrate = Math.max(0, this.celebrate - dt)
    this.landSquash = damp(this.landSquash, 0, 8, dt)

    const bobSpeed = playing ? 6.5 : 2.4
    const bobAmp = playing ? 0.055 : 0.11
    const bob = Math.sin(t * bobSpeed) * bobAmp
    const hover = 0.72 + bob
    this.root.position.set(this.x, this.y, 0)
    const faceTarget = playing ? 0 : Math.PI
    this.model.rotation.y = damp(this.model.rotation.y, faceTarget, 6, dt)
    this.root.rotation.z = damp(this.root.rotation.z, clamp(-(this.targetX - this.x) * 0.14, -0.3, 0.3), 7, dt)
    this.root.rotation.x = damp(this.root.rotation.x, playing ? -0.06 : 0, 5, dt)

    this.model.position.y = hover
    const squash = 1 - this.landSquash * 0.16
    const stretch = 1 + this.landSquash * 0.12
    this.model.scale.set(stretch, squash, stretch)
    this.model.visible = this.invuln > 0 ? Math.floor(t * 16) % 2 === 0 : true

    this.antenna.rotation.z = -0.18 + Math.sin(t * 3.4) * 0.13 + this.root.rotation.z * 0.5
    this.antenna.rotation.x = Math.sin(t * 2.7) * 0.1

    const wave = this.celebrate > 0 || !playing
    if (wave) {
      const waveAmt = this.celebrate > 0 ? 2.5 : 2.15
      this.armR.pivot.rotation.z = waveAmt + Math.sin(t * 9) * 0.38
      this.armR.pivot.rotation.x = 0.15
      this.armL.pivot.rotation.z = -0.45 + Math.sin(t * 9 + 1.4) * 0.16
    } else {
      this.armR.pivot.rotation.z = damp(this.armR.pivot.rotation.z, -0.32 + Math.sin(t * 7) * 0.12, 9, dt)
      this.armR.pivot.rotation.x = 0
      this.armL.pivot.rotation.z = damp(this.armL.pivot.rotation.z, 0.32 - Math.sin(t * 7 + 0.6) * 0.12, 9, dt)
      this.armL.pivot.rotation.x = 0
    }

    this.eyes.forEach((eye, i) => {
      const blink = Math.sin(t * 1.3 + i * 0.2) > 0.985 ? 0.15 : 1
      eye.scale.y = 1.15 * blink
    })

    this.hoverRing.rotation.z = t * 2.6
    const ringPulse = 1 + Math.sin(t * 5.2) * 0.05
    this.hoverRing.scale.set(ringPulse, ringPulse, ringPulse)
    this.hoverGlow.material.opacity = 0.35 + Math.sin(t * 7.4) * 0.1

    for (let i = 0; i < this.scarf.length; i++) {
      const seg = this.scarf[i]
      const phase = t * (playing ? 9 : 5) - i * 0.85
      const sway = Math.sin(phase) * (0.03 + i * 0.018)
      seg.position.x = i * 0.085 + sway * (playing ? 1.7 : 1)
      seg.position.y = Math.cos(phase * 0.8) * (0.01 + i * 0.012) + (playing ? 0.04 : 0)
      seg.position.z = i * 0.14 + (playing ? Math.cos(phase) * 0.012 : 0)
      seg.rotation.y = sway * 1.4
      seg.rotation.x = Math.sin(phase + 1) * 0.1
      seg.rotation.z = -0.12 - this.root.rotation.z * 0.5
    }

    this.shadow.position.x = this.x
    this.shadow.scale.setScalar(1 - clamp(this.y / 4.5, 0, 0.5))
    this.shadow.material.opacity = 0.72 - clamp(this.y / 3.2, 0, 0.55)

    this.trailTimer -= dt
    if (playing && this.trailTimer <= 0 && Math.random() > 0.35) {
      this.trailTimer = 0.11
      this.particles.emit(new THREE.Vector3(this.x + (Math.random() - 0.5) * 0.5, this.root.position.y + 0.35, 0.45), {
        count: 1,
        colors: [0x9ffcff, 0xffd0dc, 0xffffff],
        speed: 0.55,
        spread: 1,
        gravity: -0.2,
        life: 0.65,
        size: 0.24,
        drag: 1.6,
        direction: new THREE.Vector3(0, 0.1, 0.8),
      })
    }

    this.thrusterTimer -= dt
    if (this.thrusterTimer <= 0) {
      this.thrusterTimer = playing ? 0.16 : 0.3
      this.particles.emit(new THREE.Vector3(this.x, this.root.position.y + 0.08, 0.05), {
        count: 1,
        colors: [0x8ff8ff, 0xffffff],
        speed: 0.7,
        spread: 0.35,
        gravity: 1.2,
        life: 0.45,
        size: 0.2,
        drag: 2,
        direction: new THREE.Vector3(0, -0.7, 0.1),
      })
    }

    if (wave) {
      this.eyeGlowL.material.opacity = 0.45 + Math.sin(t * 2.2) * 0.12
      this.eyeGlowR.material.opacity = this.eyeGlowL.material.opacity
    } else {
      this.eyeGlowL.material.opacity = 0.42
      this.eyeGlowR.material.opacity = 0.42
    }
  }
}
