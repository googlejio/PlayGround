const NOTES = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66]
const BASS = [130.81, 146.83, 164.81, 196.0]

export class Sound {
  constructor() {
    this.ctx = null
    this.master = null
    this.musicGain = null
    this.sfxGain = null
    this.muted = false
    try { this.muted = localStorage.getItem('hello.muted') === '1' } catch {}
    this.musicTimer = null
    this.step = 0
    this.playing = false
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {})
      return this.ctx
    }
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return null
    const ctx = new Ctx()
    this.ctx = ctx
    this.master = ctx.createGain()
    this.master.gain.value = this.muted ? 0 : 0.75
    this.master.connect(ctx.destination)

    const delay = ctx.createDelay(0.6)
    delay.delayTime.value = 0.28
    const feedback = ctx.createGain()
    feedback.gain.value = 0.28
    const damp = ctx.createBiquadFilter()
    damp.type = 'lowpass'
    damp.frequency.value = 2100
    delay.connect(damp)
    damp.connect(feedback)
    feedback.connect(delay)
    const echo = ctx.createGain()
    echo.gain.value = 0.32
    delay.connect(echo)
    echo.connect(this.master)

    this.musicGain = ctx.createGain()
    this.musicGain.gain.value = 0.16
    this.musicGain.connect(this.master)
    this.musicGain.connect(delay)

    this.sfxGain = ctx.createGain()
    this.sfxGain.gain.value = 0.7
    this.sfxGain.connect(this.master)
    this.sfxGain.connect(delay)

    if (ctx.state === 'suspended') ctx.resume().catch(() => {})
    return ctx
  }

  setMuted(value) {
    this.muted = value
    try { localStorage.setItem('hello.muted', value ? '1' : '0') } catch {}
    if (this.master && this.ctx) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime)
      this.master.gain.linearRampToValueAtTime(value ? 0 : 0.75, this.ctx.currentTime + 0.08)
    }
  }

  toggleMute() {
    this.setMuted(!this.muted)
    return this.muted
  }

  tone({ freq = 440, to = null, dur = 0.2, type = 'sine', gain = 0.2, delay = 0, dest = null }) {
    const ctx = this.ensure()
    if (!ctx || this.muted) return
    const t0 = ctx.currentTime + delay
    const osc = ctx.createOscillator()
    const env = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t0)
    if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur)
    env.gain.setValueAtTime(0.0001, t0)
    env.gain.exponentialRampToValueAtTime(gain, t0 + 0.012)
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    osc.connect(env)
    env.connect(dest || this.sfxGain)
    osc.start(t0)
    osc.stop(t0 + dur + 0.03)
  }

  noise({ dur = 0.25, gain = 0.12, delay = 0, freq = 900, type = 'lowpass' }) {
    const ctx = this.ensure()
    if (!ctx || this.muted) return
    const t0 = ctx.currentTime + delay
    const length = Math.max(1, Math.floor(ctx.sampleRate * dur))
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length)
    const src = ctx.createBufferSource()
    src.buffer = buffer
    const filter = ctx.createBiquadFilter()
    filter.type = type
    filter.frequency.value = freq
    const env = ctx.createGain()
    env.gain.setValueAtTime(gain, t0)
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    src.connect(filter)
    filter.connect(env)
    env.connect(this.sfxGain)
    src.start(t0)
  }

  jump() {
    this.tone({ freq: 380, to: 760, dur: 0.16, type: 'triangle', gain: 0.15 })
    this.noise({ dur: 0.12, gain: 0.03, freq: 2400, type: 'highpass' })
  }

  doubleJump() {
    this.tone({ freq: 660, to: 1180, dur: 0.18, type: 'triangle', gain: 0.13 })
  }

  pickup() {
    this.tone({ freq: 880, to: 1320, dur: 0.12, type: 'sine', gain: 0.14 })
    this.tone({ freq: 1320, dur: 0.09, type: 'triangle', gain: 0.06, delay: 0.05 })
  }

  letter(index) {
    const base = NOTES[Math.min(index + 1, NOTES.length - 1)]
    this.tone({ freq: base, dur: 0.2, type: 'triangle', gain: 0.17 })
    this.tone({ freq: base * 1.5, dur: 0.24, type: 'sine', gain: 0.1, delay: 0.055 })
    this.tone({ freq: base * 2, dur: 0.28, type: 'sine', gain: 0.06, delay: 0.12 })
  }

  heart() {
    this.tone({ freq: 523.25, to: 783.99, dur: 0.22, type: 'sine', gain: 0.16 })
    this.tone({ freq: 1046.5, dur: 0.2, type: 'sine', gain: 0.08, delay: 0.1 })
  }

  hit() {
    this.noise({ dur: 0.35, gain: 0.2, freq: 520 })
    this.tone({ freq: 180, to: 70, dur: 0.32, type: 'sawtooth', gain: 0.14 })
  }

  word() {
    const seq = [523.25, 659.25, 783.99, 1046.5, 1318.5]
    seq.forEach((freq, i) => this.tone({ freq, dur: 0.34, type: 'triangle', gain: 0.14, delay: i * 0.09 }))
    seq.forEach((freq, i) => this.tone({ freq: freq * 0.5, dur: 0.5, type: 'sine', gain: 0.05, delay: i * 0.09 }))
  }

  over() {
    ;[523.25, 440, 349.23, 261.63].forEach((freq, i) =>
      this.tone({ freq, dur: 0.5, type: 'triangle', gain: 0.12, delay: i * 0.16 }))
  }

  click() {
    this.tone({ freq: 740, to: 980, dur: 0.09, type: 'sine', gain: 0.1 })
  }

  startMusic() {
    if (this.musicTimer || this.muted) return
    this.ensure()
    this.playing = true
    this.step = 0
    const tick = () => {
      if (!this.playing) return
      const ctx = this.ctx
      if (!ctx) return
      const step = this.step++
      if (step % 4 === 0) {
        const bass = BASS[(step / 4) % BASS.length]
        this.tone({ freq: bass, dur: 1.5, type: 'sine', gain: 0.09, dest: this.musicGain })
      }
      if (Math.random() > 0.32) {
        const note = NOTES[Math.floor(Math.random() * NOTES.length)] * (Math.random() < 0.12 ? 2 : 1)
        this.tone({ freq: note, dur: 1.1, type: 'triangle', gain: 0.07, dest: this.musicGain, delay: (Math.random() * 0.1) })
      }
      if (Math.random() > 0.72) {
        this.tone({ freq: NOTES[Math.floor(Math.random() * 3)] * 2, dur: 0.7, type: 'sine', gain: 0.035, dest: this.musicGain })
      }
    }
    tick()
    this.musicTimer = setInterval(tick, 620)
  }

  stopMusic() {
    this.playing = false
    if (this.musicTimer) clearInterval(this.musicTimer)
    this.musicTimer = null
  }
}
