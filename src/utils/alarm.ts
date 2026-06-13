export function playPriorityAlarm() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (
        window as typeof window & {
          webkitAudioContext?: typeof AudioContext
        }
      ).webkitAudioContext

    if (!AudioContextClass) {
      return
    }

    const audioContext = new AudioContextClass()
    const startTime = audioContext.currentTime
    const gain = audioContext.createGain()

    gain.connect(audioContext.destination)
    gain.gain.setValueAtTime(0.0001, startTime)
    gain.gain.exponentialRampToValueAtTime(0.42, startTime + 0.03)
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 2.2)

    ;[0, 0.34, 0.68, 1.12, 1.46].forEach((offset, index) => {
      const oscillator = audioContext.createOscillator()

      oscillator.type = index % 2 === 0 ? 'square' : 'sawtooth'
      oscillator.frequency.setValueAtTime(980, startTime + offset)
      oscillator.frequency.setValueAtTime(720, startTime + offset + 0.14)
      oscillator.connect(gain)
      oscillator.start(startTime + offset)
      oscillator.stop(startTime + offset + 0.22)
    })

    window.navigator.vibrate?.([350, 120, 350, 120, 500])

    window.setTimeout(() => {
      audioContext.close()
    }, 2400)
  } catch {
    window.navigator.vibrate?.([350, 120, 350])
  }
}
