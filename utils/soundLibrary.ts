
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { InstrumentConfig, SoundPatch, SoundCategory } from '../types';

const createPatch = (
    id: string, 
    name: string, 
    category: SoundCategory, 
    color: string, 
    config: Partial<InstrumentConfig>
): SoundPatch => ({
    id,
    name,
    category,
    themeColor: color,
    config: {
        sourceType: 'synth',
        waveform: 'sine',
        baseOctave: 4,
        attack: 0.01,
        decay: 0.2,
        sustain: 0.3,
        release: 0.5,
        vol: 1.0, 
        pan: 0,
        timbre: 0.5,
        time: 0.5,
        color: 0.5,
        drive: 0.0,
        probability: 1.0,
        filterType: 'lowpass', // Default to safest filter
        filterFreq: 1000,
        ...config
    } as InstrumentConfig
});

export const SOUND_LIBRARY: SoundPatch[] = [
    // --- ANALOG PACK ---
    createPatch('ana_bass', 'Moog Sub', 'Analog', '#e11d48', { 
        waveform: 'sawtooth',
        baseOctave: 2, // Audible sub
        attack: 0.02,
        decay: 0.3,
        sustain: 0.8,
        release: 0.4,
        detuneAmount: 10,
        subLevel: 1.0,
        filterType: 'lowpass',
        filterFreq: 400, 
        filterQ: 1,
        timbre: 0.6,
        color: 0.3,
        vol: 1.2 // Boosted for sub power
    }),
    createPatch('ana_brass', 'Prophet Brass', 'Analog', '#d97706', { 
        waveform: 'sawtooth',
        baseOctave: 3,
        attack: 0.15,
        decay: 0.4,
        sustain: 0.5,
        release: 1.2,
        detuneAmount: 15,
        filterType: 'lowpass',
        filterFreq: 1200,
        color: 0.7,
        vol: 0.9
    }),
    createPatch('ana_lead', 'Vintage Lead', 'Analog', '#f59e0b', { 
        waveform: 'square',
        baseOctave: 4,
        attack: 0.01,
        decay: 0.2,
        sustain: 0.4,
        release: 0.3,
        detuneAmount: 5,
        wobbleAmount: 0.4,
        wobbleSpeed: 8, 
        filterType: 'lowpass',
        filterFreq: 2000,
        color: 0.8,
        vol: 0.8
    }),

    // --- ACID PACK ---
    createPatch('acd_sq', 'Acid Squall', 'Acid', '#84cc16', {
        waveform: 'sawtooth',
        baseOctave: 2,
        attack: 0.01,
        decay: 0.3,
        sustain: 0.2,
        release: 0.1,
        filterType: 'lowpass',
        filterFreq: 800,
        filterQ: 8,
        timbre: 0.9, 
        color: 0.6, 
        drive: 0.5,
        vol: 0.9
    }),
    createPatch('acd_tox', 'Toxic 303', 'Acid', '#a3e635', {
        waveform: 'square',
        baseOctave: 3,
        attack: 0.01,
        decay: 0.2,
        sustain: 0.0,
        release: 0.2,
        filterType: 'lowpass',
        filterFreq: 1200,
        filterQ: 6,
        color: 0.8,
        drive: 0.6,
        vol: 0.9
    }),

    // --- ORGANIC PACK ---
    createPatch('org_scrap', 'Scrap Metal', 'Organic', '#78716c', {
        waveform: 'triangle', 
        baseOctave: 3,
        attack: 0.005,
        decay: 0.15,
        sustain: 0,
        release: 0.3,
        detuneAmount: 0,
        filterType: 'lowpass', // Fixed: Was Highpass, caused silence
        filterFreq: 1200, 
        timbre: 1.0, // Heavy FM
        wobbleAmount: 0.2,
        color: 0.7,
        drive: 0.4,
        vol: 1.1
    }),
    createPatch('org_wood', 'Bamboo', 'Organic', '#a8a29e', {
        waveform: 'sine',
        baseOctave: 4,
        attack: 0.005,
        decay: 0.1,
        sustain: 0,
        release: 0.1,
        filterType: 'lowpass',
        filterFreq: 1500,
        vol: 1.0,
        color: 0.4
    }),
    createPatch('org_hydro', 'Hydro Phone', 'Organic', '#0ea5e9', {
        waveform: 'triangle',
        baseOctave: 4,
        attack: 0.05,
        decay: 0.3,
        sustain: 0.3,
        release: 0.6,
        filterType: 'bandpass',
        filterFreq: 800,
        wobbleAmount: 0.5,
        wobbleSpeed: 4,
        color: 0.5,
        vol: 0.9
    }),

    // --- CHORD PACK ---
    createPatch('chd_dub', 'Dub Minor', 'Chord', '#6366f1', {
        waveform: 'sawtooth',
        baseOctave: 3,
        attack: 0.02,
        decay: 0.4,
        sustain: 0.5,
        release: 1.5,
        detuneAmount: 5, 
        filterType: 'lowpass',
        filterFreq: 600,
        time: 0.8,
        color: 0.4,
        vol: 0.9
    }),
    createPatch('chd_rave', 'Rave Stack', 'Chord', '#ec4899', {
        waveform: 'sawtooth',
        baseOctave: 4,
        attack: 0.01,
        decay: 0.3,
        sustain: 0.4,
        release: 0.4,
        detuneAmount: 20, 
        filterType: 'lowpass', // Fixed: Bandpass was thinning it out
        filterFreq: 2000,
        color: 0.8, 
        drive: 0.2,
        vol: 0.8
    }),

    // --- VOICE PACK ---
    createPatch('voc_choir', 'Cyber Choir', 'Voice', '#2dd4bf', {
        waveform: 'triangle',
        baseOctave: 4,
        attack: 0.4,
        decay: 0.6,
        sustain: 0.7,
        release: 1.0,
        detuneAmount: 15,
        filterType: 'lowpass',
        filterFreq: 1500,
        wobbleAmount: 0.1,
        time: 0.8,
        color: 0.6,
        vol: 0.9
    }),
    createPatch('voc_robot', 'AI Speech', 'Voice', '#14b8a6', {
        waveform: 'sawtooth',
        baseOctave: 3,
        attack: 0.05,
        decay: 0.2,
        sustain: 0.4,
        release: 0.3,
        bitCrush: 0.4,
        filterType: 'lowpass', // Fixed: Highpass caused silence
        filterFreq: 2000,
        wobbleAmount: 0.8, 
        wobbleSpeed: 15,
        drive: 0.5,
        color: 0.6,
        vol: 1.0
    }),

    // --- CINEMATIC PACK ---
    createPatch('cin_braam', 'Braam Hit', 'Cinematic', '#be123c', {
        waveform: 'sawtooth',
        baseOctave: 2, // Raised from 1 for audibility
        attack: 0.01, // Fast impact
        decay: 0.5,
        sustain: 0.5,
        release: 1.5,
        detuneAmount: 25,
        filterType: 'lowpass',
        filterFreq: 800,
        drive: 0.7,
        timbre: 0.8,
        color: 0.3,
        vol: 1.0 
    }),
    createPatch('cin_swarm', 'Horror Bow', 'Cinematic', '#9f1239', {
        waveform: 'sawtooth',
        baseOctave: 5,
        attack: 0.2,
        decay: 1.5,
        sustain: 0.8,
        release: 2.0,
        detuneAmount: 35,
        filterType: 'lowpass',
        filterFreq: 2000,
        wobbleAmount: 0.4,
        time: 0.9,
        color: 0.7,
        vol: 0.8
    }),

    // --- NOISE PACK ---
    createPatch('nse_static', 'High Voltage', 'Noise', '#a1a1aa', {
        waveform: 'square', 
        baseOctave: 5,
        attack: 0.01,
        decay: 0.15,
        sustain: 0.1,
        release: 0.2,
        bitCrush: 0.8,
        filterType: 'lowpass', // Fixed from Bandpass
        filterFreq: 4000, 
        wobbleAmount: 1.0, 
        drive: 0.8,
        color: 0.6,
        vol: 1.0
    }),
    createPatch('nse_geiger', 'Geiger', 'Noise', '#52525b', {
        waveform: 'square', 
        baseOctave: 6, // Lowered from 7
        attack: 0.001,
        decay: 0.03,
        sustain: 0,
        release: 0.05,
        filterType: 'lowpass', // Fixed from Highpass
        filterFreq: 5000,
        drive: 1.0,
        vol: 1.2,
        color: 0.9
    }),

    // --- RETRO PACK ---
    createPatch('ret_jump', 'Game Jump', 'Retro', '#fbbf24', {
        waveform: 'square',
        baseOctave: 4,
        attack: 0.001,
        decay: 0.2,
        sustain: 0,
        release: 0.2,
        filterType: 'lowpass',
        filterFreq: 3000,
        bitCrush: 0.6,
        drive: 0.3,
        color: 0.8,
        vol: 0.9
    }),

    // --- DIGITAL PACK ---
    createPatch('dig_bell', 'Ice Bell', 'Digital', '#06b6d4', { 
        waveform: 'sine',
        baseOctave: 5,
        attack: 0.01,
        decay: 0.4,
        sustain: 0.1,
        release: 1.5,
        detuneAmount: 5,
        filterType: 'lowpass',
        filterFreq: 3000,
        bitCrush: 0.2,
        timbre: 0.4,
        color: 0.8,
        vol: 0.8
    }),
    createPatch('dig_keys', 'FM Keys', 'Digital', '#3b82f6', { 
        waveform: 'sine',
        baseOctave: 4,
        attack: 0.02,
        decay: 0.2,
        sustain: 0.4,
        release: 0.6,
        detuneAmount: 50, 
        subLevel: 0,
        filterType: 'lowpass',
        filterFreq: 2500,
        wobbleAmount: 0.2,
        timbre: 0.8, 
        color: 0.7,
        vol: 0.9
    }),

    // --- GLITCH PACK ---
    createPatch('dig_rot', 'Bit Rot', 'Glitch', '#6366f1', { 
        waveform: 'sawtooth',
        baseOctave: 2,
        attack: 0.01,
        decay: 0.1,
        sustain: 0.2,
        release: 0.1,
        bitCrush: 0.8,
        downSample: 0.6,
        filterType: 'lowpass', 
        filterFreq: 1500,
        wobbleAmount: 0.5,
        timbre: 0.9,
        drive: 0.8,
        vol: 1.0
    }),
    createPatch('dig_err', 'Server Crash', 'Glitch', '#ef4444', {
        waveform: 'square',
        baseOctave: 4,
        attack: 0.001,
        decay: 0.1,
        sustain: 0,
        release: 0.1,
        bitCrush: 0.9,
        filterType: 'lowpass', // Fixed
        filterFreq: 3000,
        vol: 0.9,
        color: 0.9,
        drive: 0.9
    }),
    createPatch('dig_chime', 'Prism', 'Digital', '#d8b4fe', { 
        waveform: 'sine',
        baseOctave: 6,
        attack: 0.01,
        decay: 0.3,
        sustain: 0,
        release: 0.8,
        vol: 0.8,
        color: 0.8,
        filterType: 'lowpass',
        filterFreq: 4000
    }),
    createPatch('dig_glitch', 'Data Rot', 'Glitch', '#6366f1', { 
        waveform: 'sawtooth',
        baseOctave: 3,
        attack: 0.01,
        decay: 0.1,
        sustain: 0,
        release: 0.1,
        bitCrush: 0.9,
        downSample: 0.8,
        vol: 0.9,
        drive: 0.8,
        filterType: 'lowpass',
        filterFreq: 2000
    }),

    // --- GRANULAR PACK ---
    createPatch('grn_cloud', 'Cloud Tex', 'Granular', '#10b981', { 
        sourceType: 'granular',
        waveform: 'sine', 
        baseOctave: 4,
        attack: 0.5,
        decay: 0.5,
        sustain: 0.5,
        release: 0.5,
        grainSize: 0.2,
        grainJitter: 0.3,
        vol: 0.8,
        timbre: 0.5,
        color: 0.5
    }),
    createPatch('grn_time', 'Time Stretch', 'Granular', '#34d399', { 
        sourceType: 'granular',
        waveform: 'sawtooth',
        baseOctave: 3,
        attack: 0.1,
        decay: 0.2,
        sustain: 0.4,
        release: 0.4,
        grainSize: 0.05,
        grainJitter: 0.1,
        vol: 0.7,
        timbre: 0.8,
        color: 0.7
    }),

    // --- ATMOSPHERE PACK ---
    createPatch('atm_nebula', 'Nebula Pad', 'Atmosphere', '#8b5cf6', { 
        waveform: 'sawtooth',
        baseOctave: 2,
        attack: 0.05, 
        decay: 2.0,
        sustain: 1.0,
        release: 2.5, // Shortened from 4.0 to prevent mud
        detuneAmount: 20,
        filterType: 'lowpass',
        filterFreq: 600,
        spatialMod: true, 
        vol: 0.8, // Slightly boosted back up
        time: 0.9,
        color: 0.4
    }),
    createPatch('atm_deep', 'Deep Space', 'Atmosphere', '#4c1d95', { 
        waveform: 'sine',
        baseOctave: 1,
        attack: 0.1,
        decay: 1.0,
        sustain: 1.0,
        release: 3.0,
        subLevel: 1.0, 
        filterType: 'lowpass',
        filterFreq: 300,
        vol: 0.7, // Reduced from 1.0
        timbre: 0.2,
        color: 0.2
    }),

    // --- PERCUSSION PACK ---
    createPatch('prc_kick', '808 Sub', 'Percussion', '#be123c', { 
        sourceType: 'synth', 
        drumType: '808', 
        waveform: 'sine',
        baseOctave: 2, 
        attack: 0.005,
        decay: 0.4,
        sustain: 0,
        release: 0.1,
        vol: 1.5, // Boosted for kick presence
        filterType: 'lowpass',
        filterFreq: 400,
        time: 0.3,
        color: 0.3
    }),
    createPatch('prc_click', 'Static Click', 'Percussion', '#94a3b8', { 
        sourceType: 'synth',
        drumType: 'glitch',
        waveform: 'square',
        baseOctave: 6,
        attack: 0.001,
        decay: 0.05,
        sustain: 0,
        release: 0.05,
        filterType: 'lowpass', // Fixed
        filterFreq: 4000, 
        color: 0.8,
        drive: 0.5,
        vol: 1.2
    }),
    createPatch('prc_wood', 'Log Drum', 'Percussion', '#78350f', { 
        waveform: 'sine',
        baseOctave: 3,
        attack: 0.01,
        decay: 0.1,
        sustain: 0,
        release: 0.1,
        filterType: 'lowpass',
        filterFreq: 600,
        detuneAmount: 15,
        color: 0.5,
        vol: 1.0
    })
];

export const getSoundPatch = (id: string) => SOUND_LIBRARY.find(p => p.id === id);
export const getRandomPatch = () => SOUND_LIBRARY[Math.floor(Math.random() * SOUND_LIBRARY.length)];
export const getNextPatch = (currentId: string | undefined): SoundPatch => {
    const idx = SOUND_LIBRARY.findIndex(p => p.id === currentId);
    if (idx === -1) return SOUND_LIBRARY[0];
    return SOUND_LIBRARY[(idx + 1) % SOUND_LIBRARY.length];
};
export const getPrevPatch = (currentId: string | undefined): SoundPatch => {
    const idx = SOUND_LIBRARY.findIndex(p => p.id === currentId);
    if (idx === -1) return SOUND_LIBRARY[SOUND_LIBRARY.length - 1];
    return SOUND_LIBRARY[(idx - 1 + SOUND_LIBRARY.length) % SOUND_LIBRARY.length];
};
