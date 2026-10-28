// Chromatic octave: white notes Z X C V B N M; black notes S D G H J.
export const pianoKeys = ['Z', 'S', 'X', 'D', 'C', 'V', 'G', 'B', 'H', 'N', 'J', 'M', ','];
export function midiForKey(key: string): number | null {
  const index = pianoKeys.indexOf(key.toUpperCase());
  return index < 0 ? null : 36 + index;
}
