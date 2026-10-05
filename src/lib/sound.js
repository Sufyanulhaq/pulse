/** Sounds made with the Web Audio API, so the app ships no audio files. */
let ctx = null

function audio() {
  if (!ctx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (!AudioContext) return null
    ctx = new AudioContext()
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

/** A soft three note chime for the end of a phase. */
export function chime(kind = 'focus') {
  const ac = audio()
  if (!ac) return
  const notes = kind === 'focus' ? [523.25, 659.25, 783.99] : [783.99, 659.25, 523.25]
  notes.forEach((freq, i) => {
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    const t = ac.currentTime + i * 0.18
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(0.18, t + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.9)
    osc.connect(gain).connect(ac.destination)
    osc.start(t)
    osc.stop(t + 1)
  })
}

export const NOISES = [
  { id: 'brown', label: 'Brown noise', hint: 'Deep, like distant rain' },
  { id: 'pink', label: 'Pink noise', hint: 'Balanced, like wind' },
  { id: 'white', label: 'White noise', hint: 'Bright, like a fan' },
]

function noiseBuffer(ac, type) {
  const length = ac.sampleRate * 4
  const buffer = ac.createBuffer(1, length, ac.sampleRate)
  const data = buffer.getChannelData(0)
  let last = 0
  let b0 = 0
  let b1 = 0
  let b2 = 0
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1
    if (type === 'white') {
      data[i] = white * 0.3
    } else if (type === 'brown') {
      last = (last + 0.02 * white) / 1.02
      data[i] = last * 3.5
    } else {
      b0 = 0.99765 * b0 + white * 0.099046
      b1 = 0.963 * b1 + white * 0.2965164
      b2 = 0.57 * b2 + white * 1.0526913
      data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.06
    }
  }
  return buffer
}

let current = null

export function playNoise(type, volume) {
  const ac = audio()
  if (!ac) return false
  stopNoise()
  const source = ac.createBufferSource()
  source.buffer = noiseBuffer(ac, type)
  source.loop = true
  const gain = ac.createGain()
  gain.gain.value = 0
  gain.gain.linearRampToValueAtTime(volume, ac.currentTime + 0.6)
  source.connect(gain).connect(ac.destination)
  source.start()
  current = { source, gain }
  return true
}

export function setNoiseVolume(volume) {
  if (current && ctx) current.gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.1)
}

export function stopNoise() {
  if (!current || !ctx) return
  const { source, gain } = current
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3)
  source.stop(ctx.currentTime + 0.35)
  current = null
}
