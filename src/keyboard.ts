// Chromatic octave: white notes Z X C V B N M; black notes S D G H J.
export const pianoKeys = ['Z', 'S', 'X', 'D', 'C', 'V', 'G', 'B', 'H', 'N', 'J', 'M', ','];
export function midiForKey(key: string): number | null {
  const index = pianoKeys.indexOf(key.toUpperCase());
  return index < 0 ? null : 36 + index;
}

export function transposeNotes(notes: (number | null)[], semitones: number, step?: number): (number | null)[] {
  const shifted = notes.map((note,i)=>note===null||(step!==undefined&&i!==step)?note:note+semitones);
  if(shifted.some(note=>note!==null&&(!Number.isInteger(note)||note<0||note>127))) throw Error('That move would exceed the supported note range.');
  return shifted;
}
