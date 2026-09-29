/**
 * Balloon sounds, synthesised with Web Audio — no audio files to fetch.
 * Only ever called from a guest's tap, so browsers allow playback.
 */

let ctx: AudioContext | null = null
let noiseBuffer: AudioBuffer | null = null

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return null
      ctx = new AC()
      noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
      const data = noiseBuffer.getChannelData(0)
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    }
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    // Sound is decorative — failure is silent.
    return null
  }
}

/** The squeaky, fluttering "pffffrrt" of air escaping through the knot. */
export function playLeak(seconds: number) {
  const ac = audio()
  if (!ac || !noiseBuffer) return
  const t = ac.currentTime
  const end = t + seconds

  const master = ac.createGain()
  master.gain.value = 0.55
  master.connect(ac.destination)

  // Rubbery squeal: a buzzy tone whose pitch wobbles fast and sags as the balloon empties.
  const osc = ac.createOscillator()
  osc.type = 'sawtooth'
  const startHz = 460 + Math.random() * 160
  osc.frequency.setValueAtTime(startHz, t)
  osc.frequency.linearRampToValueAtTime(startHz * 1.12, t + seconds * 0.2)
  osc.frequency.exponentialRampToValueAtTime(130, end)

  const lfo = ac.createOscillator()
  lfo.frequency.setValueAtTime(18 + Math.random() * 8, t)
  lfo.frequency.linearRampToValueAtTime(34, end)
  const lfoDepth = ac.createGain()
  lfoDepth.gain.value = startHz * 0.12
  lfo.connect(lfoDepth)
  lfoDepth.connect(osc.frequency)

  const tone = ac.createBiquadFilter()
  tone.type = 'lowpass'
  tone.frequency.value = 1700
  const squeal = ac.createGain()
  squeal.gain.setValueAtTime(0.0001, t)
  squeal.gain.exponentialRampToValueAtTime(0.16, t + 0.03)
  squeal.gain.setValueAtTime(0.16, t + seconds * 0.6)
  squeal.gain.exponentialRampToValueAtTime(0.0001, end)
  osc.connect(tone)
  tone.connect(squeal)
  squeal.connect(master)

  // Air hiss underneath.
  const noise = ac.createBufferSource()
  noise.buffer = noiseBuffer
  const band = ac.createBiquadFilter()
  band.type = 'bandpass'
  band.Q.value = 0.9
  band.frequency.setValueAtTime(2600, t)
  band.frequency.exponentialRampToValueAtTime(800, end)
  const hiss = ac.createGain()
  hiss.gain.setValueAtTime(0.0001, t)
  hiss.gain.exponentialRampToValueAtTime(0.13, t + 0.02)
  hiss.gain.exponentialRampToValueAtTime(0.0001, end)
  noise.connect(band)
  band.connect(hiss)
  hiss.connect(master)

  osc.start(t)
  lfo.start(t)
  noise.start(t)
  osc.stop(end + 0.05)
  lfo.stop(end + 0.05)
  noise.stop(end + 0.05)
}

/** A soft wooden "tok" when the dropped letter lands. */
export function playTok(delaySeconds: number, loudness: number) {
  const ac = audio()
  if (!ac) return
  const t = ac.currentTime + delaySeconds
  const osc = ac.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(320, t)
  osc.frequency.exponentialRampToValueAtTime(140, t + 0.09)
  const gain = ac.createGain()
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(0.3 * loudness, t + 0.005)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.14)
  osc.connect(gain)
  gain.connect(ac.destination)
  osc.start(t)
  osc.stop(t + 0.16)
}
