// Web Audio API beeps — no external files required

let _ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!_ctx) {
    _ctx = new AudioContext();
  }
  return _ctx;
}

function playTone(
  frequency: number | [number, number],
  durationMs: number,
  type: OscillatorType,
  gainValue = 0.3
): void {
  try {
    const ctx = getCtx();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    if (Array.isArray(frequency)) {
      oscillator.frequency.setValueAtTime(frequency[0], ctx.currentTime);
      oscillator.frequency.linearRampToValueAtTime(frequency[1], ctx.currentTime + durationMs / 1000);
    } else {
      oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
    }

    oscillator.type = type;
    gainNode.gain.setValueAtTime(gainValue, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + durationMs / 1000);
  } catch {
    // Silent fail — AudioContext may not be available in SSR or restricted contexts
  }
}

export function playSuccessBeep(): void {
  playTone(1760, 100, 'square', 0.45);
}

export function playErrorBeep(): void {
  playTone(2400, 80, 'square', 0.45);
  setTimeout(() => playTone(2400, 80, 'square', 0.45), 140);
}
