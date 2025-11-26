

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export interface Vector2 {
  x: number;
  y: number;
}

export interface Ball {
  id: string;
  pos: Vector2;
  vel: Vector2;
  radius: number;
  color: string;
  lastImpactTime?: number;
  trail?: Vector2[]; // For visual trails
}

export interface FlockConfig {
  enabled: boolean;
  boidCount: number;
  perceptionRadius: number;
  maxForce: number;
  maxSpeed: number;
  separationWeight: number;
  alignmentWeight: number;
  cohesionWeight: number;
  color: string;
  personality: 'caged' | 'free' | 'chaotic' | 'lazy' | 'aggressive';
  
  // Euclidean Rhythm Params
  euclideanHits: number;  // How many beats
  euclideanSteps: number; // In how many steps (e.g., 3 hits in 8 steps)
}

export type ShapeType = 'triangle' | 'square' | 'pentagon' | 'hexagon' | 'octagon' | 'star';
export type SoundWaveform = 'sine' | 'square' | 'sawtooth' | 'triangle';
export type MusicalScale = 'major' | 'minor' | 'pentatonic' | 'chromatic' | 'dorian' | 'lydian' | 'phrygian' | 'harmonics';
export type RootKey = 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F' | 'F#' | 'G' | 'G#' | 'A' | 'A#' | 'B';
export type DrumType = '808' | '909' | 'glitch';

export interface InstrumentConfig {
  sourceType?: 'synth' | 'sampler' | 'physical' | 'granular'; 
  sampleBuffer?: AudioBuffer | null; 
  sampleUrl?: string; 
  soundId?: string; // ID from SoundLibrary

  waveform: SoundWaveform;
  baseOctave: number;
  
  // Macros (0.0 to 1.0)
  timbre?: number; // Brightness, FM, Saturation, Bitcrush
  time?: number;   // Release, Reverb Send, Delay Send
  color?: number;  // Filter Cutoff / Tone / Resonance
  drive?: number;  // Distortion / Overdrive / BitCrush
  chaos?: number;  // NEW: Particle Turbulence / Random Velocity
  
  // Generative / Musicality
  probability?: number; // 0 to 1. Chance that an impact triggers sound.

  // Analog Synth Parameters
  detuneAmount?: number; // 0 to 50 cents
  subLevel?: number; // 0 to 1
  noiseLevel?: number; // 0 to 1
  
  // Physical Modeling Parameters
  damping?: number; // 0-1 (Brightness/Decay)
  tension?: number; // 0-1 (Sustain/Feedback)
  
  // Granular Parameters
  grainSize?: number; // 0-1 (Short to Long)
  grainJitter?: number; // 0-1 (Randomness)

  // Modulation & FX
  wobbleAmount?: number; // 0 to 1 (Impact LFO Depth)
  wobbleSpeed?: number; // LFO Frequency in Hz
  spatialMod?: boolean; // If true, impact position affects Pan/Filter
  
  // Drum / Rhythm
  drumType?: DrumType; // If set, this instrument is primarily percussive (triggers on boid collisions)
  
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  
  vol: number;
  pan: number; // -1 to 1 (Base pan, overridden if spatialMod is true)
  filterType?: BiquadFilterType;
  filterFreq?: number;
  filterQ?: number;

  // Lo-Fi Character
  bitCrush?: number; // 0 to 1 (0 = clean, 1 = 4 bit)
  downSample?: number; // 0 to 1 (0 = clean, 1 = 1/10th sample rate)
}

export type SoundCategory = 'Analog' | 'Digital' | 'Atmosphere' | 'Percussion' | 'Granular' | 'Acid' | 'Organic' | 'Chord' | 'Glitch' | 'Voice' | 'Noise' | 'Cinematic' | 'Retro';

export interface SoundPatch {
    id: string;
    name: string;
    category: SoundCategory;
    themeColor: string;
    config: InstrumentConfig;
}

export interface SimulationConfig {
  id: number;
  name: string;
  shapeType: ShapeType;
  vertexCount: number;
  gravity: number;
  friction: number;
  restitution: number;
  rotationSpeed: number;
  ballCount: number;
  ballSize: number;
  initialSpeed: number;
  description: string;
  instrument: InstrumentConfig;
  themeColor: string; 
  flock: FlockConfig;
}

export interface GlobalSettings {
  timeScale: number;
  gravityMultiplier: number;
  rotationMultiplier: number;
  rootKey: RootKey;
  scale: MusicalScale;
  globalReverb: number; 
  globalFilter: number; 
  globalDelay: number; 
  isPlaying: boolean;
  mouseForceMode: 'attract' | 'repel';
  bpm: number;
  
  // Environment
  droneEnabled: boolean;
  droneVolume: number;
  noiseEnabled: boolean;
  noiseVolume: number;

  // New Features
  gravityLfoEnabled: boolean;
  gravityLfoRate: number; // Multiplier of BPM (e.g. 0.5 = half note, 1 = quarter note)
  lofiLevel?: number;
  analogDrift: number; // 0 to 1, Global pitch instability
  
  // Chaos & Randomness
  chaosEnabled: boolean; // Enables Lorenz Attractor modulation
}

export interface Snapshot {
    id: string;
    date: number;
    configs: SimulationConfig[];
    settings: GlobalSettings;
}

export interface FluxState {
    active: boolean;
    tapeStopVal: number; // 0 (Off) to 1 (Stopped)
    fracture: boolean;
    voltage: boolean;
    dimension: boolean;
    void: boolean;
    prismVal: number; // 0 to 1 (Ribbon position)
    gravityX: number;
    gravityY: number;
}