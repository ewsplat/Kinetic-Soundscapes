
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { RootKey, MusicalScale } from '../types';

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const SCALES: Record<MusicalScale, number[]> = {
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  pentatonic: [0, 3, 5, 7, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  harmonics: [], // Special handled in function
};

const BASE_A4 = 440;

export const getFrequency = (noteIndex: number, baseOctave: number): number => {
  // MIDI note calculation: A4 is 69
  // We'll treat C4 as our anchor. C4 is MIDI 60.
  const baseMidi = (baseOctave + 1) * 12; 
  const targetMidi = baseMidi + noteIndex;
  return BASE_A4 * Math.pow(2, (targetMidi - 69) / 12);
};

export const getScaleNotes = (root: RootKey, scale: MusicalScale): string[] => {
  const rootIndex = NOTES.indexOf(root);
  if (scale === 'harmonics') return [`${root} (Series)`];
  const intervals = SCALES[scale];
  return intervals.map(interval => NOTES[(rootIndex + interval) % 12]);
};

// Returns a specific frequency given a scale step index (0, 1, 2...)
// Handles wrapping around octaves
export const getFrequencyFromScale = (
  root: RootKey,
  scale: MusicalScale,
  baseOctave: number,
  scaleDegree: number,
  drift: number = 0
): number => {
  const rootIndex = NOTES.indexOf(root);
  const rootFreq = getFrequency(rootIndex, baseOctave);
  
  let targetFreq = 0;

  if (scale === 'harmonics') {
      // Pure Harmonic Series: f, 2f, 3f, 4f...
      // scaleDegree 0 -> Fundamental
      // scaleDegree 1 -> 2nd Harmonic (Octave)
      // scaleDegree 2 -> 3rd Harmonic (Octave + 5th approx)
      const n = Math.abs(Math.round(scaleDegree)) + 1;
      targetFreq = rootFreq * n;
  } else {
      const intervals = SCALES[scale];
      const octaveOffset = Math.floor(scaleDegree / intervals.length);
      const intervalIndex = scaleDegree % intervals.length;
      
      const safeIntervalIndex = intervalIndex < 0 ? intervals.length + intervalIndex : intervalIndex;
      const semitonesFromRoot = intervals[safeIntervalIndex];
      
      // Calculate MIDI note
      const rootMidi = (baseOctave + 1) * 12 + rootIndex;
      const targetMidi = rootMidi + (octaveOffset * 12) + semitonesFromRoot;
      targetFreq = BASE_A4 * Math.pow(2, (targetMidi - 69) / 12);
  }

  // Apply Analog Drift
  // Drift 0-1. Max drift +/- 100 cents approximately (Boosted).
  if (drift > 0) {
      // Random cents deviation
      const cents = (Math.random() - 0.5) * 2 * (drift * 100);
      targetFreq *= Math.pow(2, cents / 1200);
  }

  return targetFreq;
};
