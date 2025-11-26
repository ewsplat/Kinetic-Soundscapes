
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useRef, useEffect } from 'react';
import { presets } from './utils/presets';
import SimulationCard from './components/SimulationCard';
import VisualModulator from './components/VisualModulator';
import MasterVisualizer from './components/MasterVisualizer';
import FluxRig from './components/FluxRig';
import { GlobalSettings, MusicalScale, RootKey, SimulationConfig, Snapshot } from './types';
import { audio } from './utils/audio';
import { LorenzAttractor } from './utils/math';
import { getRandomPatch, SOUND_LIBRARY } from './utils/soundLibrary';
import { Play, Pause, Power, Activity, Zap, Settings2, Download, Anchor, CloudFog, Shuffle, SlidersHorizontal } from 'lucide-react';

const SCALES: MusicalScale[] = ['pentatonic', 'major', 'minor', 'dorian', 'lydian', 'chromatic', 'phrygian', 'harmonics'];
const KEYS: RootKey[] = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const sanitizeConfigs = (configs: SimulationConfig[]): SimulationConfig[] => {
    return configs.map(cfg => {
        // Allow Sampler and Granular types to persist even if ID is custom
        if (cfg.instrument.sourceType === 'sampler' || cfg.instrument.sourceType === 'granular') {
            return cfg;
        }

        const isValidId = SOUND_LIBRARY.some(p => p.id === cfg.instrument.soundId);
        // Force replace physical models that are too tense (legacy safety)
        const isUnsafePhysical = cfg.instrument.sourceType === 'physical' && (cfg.instrument.tension || 0) > 0.95;
        
        if (!isValidId || isUnsafePhysical) {
            const safePatch = SOUND_LIBRARY[0];
            return {
                ...cfg,
                themeColor: safePatch.themeColor,
                instrument: {
                    ...safePatch.config,
                    soundId: safePatch.id,
                    timbre: cfg.instrument.timbre ?? 0.5,
                    time: cfg.instrument.time ?? 0.5,
                    probability: cfg.instrument.probability ?? 1.0,
                }
            };
        }
        return cfg;
    });
};

const App: React.FC = () => {
  const [started, setStarted] = useState(false);
  const [simulationConfigs, setSimulationConfigs] = useState<SimulationConfig[]>(() => sanitizeConfigs(presets));
  const [snapshots, setSnapshots] = useState<Record<string, Snapshot>>({});
  const [activeBank, setActiveBank] = useState<'A' | 'B' | 'C'>('A');
  const [writeMode, setWriteMode] = useState(false);
  const [showFluxRig, setShowFluxRig] = useState(false);
  
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const xyPadRef = useRef<HTMLDivElement>(null);
  const tapTimesRef = useRef<number[]>([]);
  const [bpm, setBpm] = useState(120);
  const chaosRef = useRef(new LorenzAttractor());
  const chaosRequestRef = useRef<number | null>(null);
  const [glitchTrigger, setGlitchTrigger] = useState(0);

  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>({
    timeScale: 1.0,
    gravityMultiplier: 1.0,
    rotationMultiplier: 1.0,
    rootKey: 'D#',
    scale: 'dorian',
    globalReverb: 0.5,
    globalFilter: 1.0,
    globalDelay: 0.3,
    isPlaying: true,
    mouseForceMode: 'attract',
    bpm: 120,
    gravityLfoEnabled: true,
    gravityLfoRate: 1.0,
    droneEnabled: false,
    droneVolume: 0,
    noiseEnabled: true, 
    noiseVolume: 0.1,
    chaosEnabled: false,
    analogDrift: 0.1,
  });

  // Tape Stop Link
  const tapeStopRef = useRef(0);
  useEffect(() => {
      // Tape stop logic handled via FluxRig component update loop
  }, []);

  useEffect(() => {
      setSimulationConfigs(prev => sanitizeConfigs(prev));
  }, []);

  useEffect(() => {
      if (started) {
          audio.setGlobalFilter(globalSettings.globalFilter);
          audio.setGlobalDelayFeedback(globalSettings.globalDelay);
          audio.setBPM(globalSettings.bpm);
          audio.updateEnvironment(
              globalSettings.droneEnabled ? globalSettings.droneVolume : 0,
              globalSettings.noiseEnabled ? globalSettings.noiseVolume : 0,
              globalSettings.rootKey,
              globalSettings.scale
          );
      }
  }, [globalSettings, started]);

  useEffect(() => {
    const updateChaos = () => {
      if (globalSettings.chaosEnabled && started) {
         const { x, y } = chaosRef.current.update();
         const normX = Math.max(0.1, Math.min(1.0, (x + 20) / 40));
         audio.setGlobalFilter(normX);
         const normY = Math.max(0.1, Math.min(0.8, (y + 30) / 60));
         audio.setGlobalDelayFeedback(normY);
      }
      chaosRequestRef.current = requestAnimationFrame(updateChaos);
    };
    chaosRequestRef.current = requestAnimationFrame(updateChaos);
    return () => { if (chaosRequestRef.current) cancelAnimationFrame(chaosRequestRef.current); }
  }, [globalSettings.chaosEnabled, started]);

  const handleStart = async () => {
    audio.init();
    await audio.resume();
    setStarted(true);
  };

  const togglePlay = () => {
    setGlobalSettings(prev => ({ ...prev, isPlaying: !prev.isPlaying, timeScale: !prev.isPlaying ? (prev.bpm / 120) : 0 }));
  };

  const toggleRecording = async () => {
      if (isRecording) {
          const blob = await audio.stopRecording();
          setRecordedBlob(blob);
          setIsRecording(false);
      } else {
          setRecordedBlob(null);
          audio.startRecording();
          setIsRecording(true);
      }
  };

  const downloadRecording = () => {
      if (!recordedBlob) return;
      const url = URL.createObjectURL(recordedBlob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `bio-grid-jam-${Date.now()}.wav`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
  };
  
  const shuffleSounds = () => {
      setGlitchTrigger(prev => prev + 1);
      setSimulationConfigs(prev => prev.map(cfg => {
          const newPatch = getRandomPatch();
          return {
              ...cfg,
              themeColor: newPatch.themeColor,
              instrument: {
                  ...cfg.instrument, 
                  ...newPatch.config, // Use patch defaults for timbre, time, color, etc.
                  soundId: newPatch.id,
                  probability: cfg.instrument.probability // Preserve sequencer probability
              }
          };
      }));
  };

  const handleUpdateConfig = (id: number, updates: Partial<SimulationConfig>) => {
      setSimulationConfigs(prev => prev.map(cfg => {
          if (cfg.id !== id) return cfg;
          const newInstrument = updates.instrument ? { ...cfg.instrument, ...updates.instrument } : cfg.instrument;
          const newFlock = updates.flock ? { ...cfg.flock, ...updates.flock } : cfg.flock;
          return { ...cfg, ...updates, instrument: newInstrument, flock: newFlock };
      }));
  };

  // --- MEMORY BANKS ---
  const handleBankClick = (bank: 'A' | 'B' | 'C') => {
      if (writeMode) {
          // SAVE
          setSnapshots(prev => ({
              ...prev,
              [bank]: {
                  id: bank,
                  date: Date.now(),
                  configs: simulationConfigs, 
                  settings: { ...globalSettings }
              }
          }));
          setActiveBank(bank);
          setWriteMode(false); // Auto-exit write mode
      } else {
          // LOAD
          const snap = snapshots[bank];
          if (snap) {
              setSimulationConfigs(snap.configs); // This restores the reference
              setGlobalSettings(snap.settings);
              setActiveBank(bank);
              setGlitchTrigger(prev => prev + 1); 
          }
      }
  };

  const handleTap = () => {
      const now = Date.now();
      const lastTap = tapTimesRef.current[tapTimesRef.current.length - 1];
      if (lastTap && now - lastTap > 2000) tapTimesRef.current = [];
      tapTimesRef.current.push(now);
      if (tapTimesRef.current.length > 4) tapTimesRef.current.shift();

      if (tapTimesRef.current.length > 1) {
          let intervalsSum = 0;
          for (let i = 1; i < tapTimesRef.current.length; i++) intervalsSum += tapTimesRef.current[i] - tapTimesRef.current[i - 1];
          const avgInterval = intervalsSum / (tapTimesRef.current.length - 1);
          const newBpm = Math.round(60000 / avgInterval);
          const clampedBpm = Math.max(40, Math.min(240, newBpm));
          setBpm(clampedBpm);
          setGlobalSettings(prev => ({ ...prev, bpm: clampedBpm, timeScale: prev.isPlaying ? clampedBpm / 120 : 0 }));
      }
  };

  const handleXYMove = (e: React.MouseEvent | React.TouchEvent) => {
      if (!xyPadRef.current) return;
      const rect = xyPadRef.current.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
      const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, 1 - ((clientY - rect.top) / rect.height)));
      setGlobalSettings(prev => ({ ...prev, timeScale: (prev.bpm / 120) * (0.5 + x), globalFilter: y }));
  };

  if (!started) {
      return (
          <div className="min-h-screen bg-[#09090b] flex items-center justify-center text-zinc-100 relative overflow-hidden font-mono">
              <div className="noise-overlay"></div>
              <div className="scanline-overlay"></div>
              <div className="absolute inset-0 bg-grid-pattern opacity-20"></div>
              
              <div className="relative z-10 p-12 bg-[#121215] border border-[#27272a] shadow-2xl flex flex-col items-center max-w-md w-full text-center">
                  <div className="w-20 h-20 mb-8 relative group cursor-pointer" onClick={handleStart}>
                        <div className="absolute inset-0 border-2 border-dashed border-[#ea580c] rounded-full animate-[spin_12s_linear_infinite]"></div>
                        <div className="absolute inset-0 flex items-center justify-center hover:scale-110 transition-transform duration-300">
                             <Power size={32} className="text-[#ea580c]" />
                        </div>
                  </div>
                  <h1 className="text-5xl font-black tracking-tighter mb-2 text-white">BIO<span className="text-[#ea580c]">GRID</span></h1>
                  <p className="text-zinc-500 text-xs tracking-[0.4em] mb-10 uppercase">OS v3.0 // INITIALIZING...</p>
                  <button onClick={handleStart} className="w-full py-3 bg-[#ea580c] text-black font-bold tracking-widest text-xs hover:bg-white transition-colors uppercase">
                      Boot System
                  </button>
              </div>
          </div>
      );
  }

  return (
    <div className="h-screen bg-[#09090b] text-zinc-300 font-mono antialiased flex flex-col overflow-hidden relative">
      <div className="noise-overlay"></div>
      <div className="scanline-overlay"></div>

      {/* INDUSTRIAL HEADER */}
      <header className="h-16 border-b border-[#27272a] bg-[#09090b] flex items-center px-4 justify-between shrink-0 z-50 relative">
          <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-[#ea580c] flex items-center justify-center">
                      <Activity size={14} className="text-black" />
                  </div>
                  <h1 className="text-lg font-bold tracking-tighter text-white">BIO<span className="text-zinc-600">GRID</span></h1>
              </div>
              
              {/* MASTER VISUALIZER (OSCILLOSCOPE) */}
              <MasterVisualizer />
              
              <div className="h-8 w-px bg-[#27272a]"></div>
              
              {/* INFO DISPLAY */}
              <div className="hidden lg:flex items-center gap-6 text-[10px] font-bold uppercase tracking-widest">
                  <div className="flex flex-col">
                      <span className="text-zinc-600">BPM</span>
                      <span className="text-[#06b6d4]">{bpm}</span>
                  </div>
                  <div className="flex flex-col">
                      <span className="text-zinc-600">Key</span>
                      <span className="text-[#ec4899]">{globalSettings.rootKey} {globalSettings.scale.substring(0,3)}</span>
                  </div>
              </div>
          </div>

          {/* MAIN CONTROLS */}
          <div className="flex items-center gap-4">
              
              {/* MEMORY BANKS */}
              <div className="flex items-center gap-2 border border-[#27272a] p-1 bg-[#121215]">
                  {/* WRITE TOGGLE */}
                  <button 
                    onClick={() => setWriteMode(!writeMode)} 
                    className={`h-6 px-2 text-[9px] font-bold border flex items-center gap-1 transition-all ${writeMode ? 'bg-red-900/50 text-red-500 border-red-500 animate-pulse' : 'bg-[#09090b] border-[#27272a] text-zinc-600 hover:text-zinc-400'}`}
                  >
                     <div className={`w-1.5 h-1.5 rounded-full ${writeMode ? 'bg-red-500' : 'bg-current'}`}></div>
                     WRITE
                  </button>

                  <div className="flex items-center gap-0.5">
                    {(['A', 'B', 'C'] as const).map(bank => (
                        <button 
                            key={bank} 
                            onClick={() => handleBankClick(bank)} 
                            className={`w-6 h-6 text-[10px] font-bold border flex items-center justify-center transition-all
                                ${activeBank === bank && !writeMode ? 'bg-[#ea580c] text-black border-[#ea580c]' : 'bg-[#09090b] border-[#27272a] hover:border-zinc-500'}
                                ${!snapshots[bank] ? 'opacity-50 border-dashed' : ''}
                                ${writeMode ? 'hover:bg-red-900/50 hover:border-red-500 hover:text-red-500' : ''}
                            `}
                        >
                            {bank}
                        </button>
                    ))}
                  </div>
              </div>
              
              {/* FLUX RIG TOGGLE */}
              <button onClick={() => setShowFluxRig(!showFluxRig)} className={`btn-retro h-9 px-4 flex items-center gap-2 ${showFluxRig ? 'bg-white text-black border-white' : ''}`}>
                  <SlidersHorizontal size={14} />
                  <span>FLUX RIG</span>
              </button>

              {/* MUTATE BUTTON */}
              <button onClick={shuffleSounds} className="btn-retro h-9 px-6 text-white hover:bg-[#ea580c] hover:text-black hover:border-[#ea580c] flex items-center gap-2 border-zinc-700">
                  <Shuffle size={14} />
                  <span>MUTATE</span>
              </button>

              <div className="h-8 w-px bg-[#27272a]"></div>

              {/* Transport */}
              <div className="flex items-center gap-2">
                  <button onClick={toggleRecording} className={`h-9 px-4 border flex items-center gap-2 transition-all uppercase text-[10px] font-bold ${isRecording ? 'bg-red-900/50 text-red-500 border-red-500 animate-pulse' : 'bg-[#121215] border-[#27272a] text-zinc-500 hover:text-white'}`}>
                      <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-red-500' : 'bg-current'}`}></div>
                      {isRecording ? 'REC' : 'REC'}
                  </button>
                  
                  {recordedBlob && !isRecording && (
                      <button onClick={downloadRecording} className="btn-retro h-9 w-9 flex items-center justify-center text-[#06b6d4]"><Download size={14} /></button>
                  )}

                  <button onClick={handleTap} className="btn-retro h-9 px-3 text-[10px]">TAP</button>
                  <button onClick={togglePlay} className={`w-12 h-9 flex items-center justify-center border transition-all ${globalSettings.isPlaying ? 'bg-[#84cc16] text-black border-[#84cc16]' : 'bg-[#121215] text-zinc-500 border-[#27272a]'}`}>
                      {globalSettings.isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                  </button>
              </div>
          </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
          
          {/* LEFT RACK */}
          <aside className="w-64 bg-[#09090b] border-r border-[#27272a] flex flex-col shrink-0 z-20 overflow-y-auto custom-scrollbar">
              
              <VisualModulator />

              {/* XY MACRO */}
              <div className="p-4 border-b border-[#27272a]">
                  <div className="flex justify-between items-end mb-2">
                      <label className="text-[9px] font-bold text-zinc-500 tracking-widest flex items-center gap-2"><Zap size={10} className="text-[#ea580c]" /> MACRO XY</label>
                      <button onClick={() => setGlobalSettings(p => ({...p, chaosEnabled: !p.chaosEnabled}))} className={`text-[8px] px-1 border uppercase ${globalSettings.chaosEnabled ? 'border-[#06b6d4] text-[#06b6d4]' : 'border-zinc-700 text-zinc-600'}`}>
                          {globalSettings.chaosEnabled ? 'Chaos On' : 'Chaos Off'}
                      </button>
                  </div>
                  <div ref={xyPadRef} className="aspect-square w-full bg-[#121215] border border-[#27272a] relative cursor-crosshair overflow-hidden group touch-none bg-grid-pattern"
                      onMouseDown={handleXYMove} onMouseMove={(e) => e.buttons === 1 && handleXYMove(e)} onTouchStart={handleXYMove} onTouchMove={handleXYMove}>
                      <div className="absolute w-4 h-4 border border-[#ea580c] bg-[#ea580c]/20 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                          style={{ left: `${((globalSettings.timeScale / (bpm/120)) - 0.5) * 100}%`, top: `${(1 - globalSettings.globalFilter) * 100}%` }}>
                         <div className="absolute w-full h-px bg-[#ea580c] -left-[1000%] right-[1000%]"></div>
                         <div className="absolute h-full w-px bg-[#ea580c] -top-[1000%] bottom-[1000%]"></div>
                      </div>
                  </div>
              </div>

              {/* GRAVITY */}
              <div className="p-4 border-b border-[#27272a] space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-[9px] font-bold text-zinc-500 tracking-widest flex items-center gap-2"><Anchor size={10} /> GRAVITY LFO</label>
                    <button onClick={() => setGlobalSettings(p => ({...p, gravityLfoEnabled: !p.gravityLfoEnabled}))} className={`w-2 h-2 ${globalSettings.gravityLfoEnabled ? 'bg-[#84cc16]' : 'bg-zinc-700'}`}></button>
                  </div>
                  <div className="grid grid-cols-4 gap-px bg-[#27272a] border border-[#27272a]">
                      {[0.25, 0.5, 1, 2].map(rate => (
                          <button key={rate} onClick={() => setGlobalSettings(p => ({...p, gravityLfoRate: rate}))} className={`py-1 text-[8px] font-bold ${globalSettings.gravityLfoRate === rate ? 'bg-[#84cc16] text-black' : 'bg-[#121215] text-zinc-500 hover:text-zinc-300'}`}>
                              {rate}x
                          </button>
                      ))}
                  </div>
              </div>

              {/* ENVIRONMENT */}
              <div className="p-4 border-b border-[#27272a] space-y-4">
                 <label className="text-[9px] font-bold text-zinc-500 tracking-widest flex items-center gap-2"><CloudFog size={10} /> ATMOSPHERE</label>
                 {['Drone Bed', 'Tape Hiss'].map((label, i) => {
                     const isDrone = i === 0;
                     const enabled = isDrone ? globalSettings.droneEnabled : globalSettings.noiseEnabled;
                     const vol = isDrone ? globalSettings.droneVolume : globalSettings.noiseVolume;
                     return (
                        <div key={label} className="space-y-1">
                            <div className="flex justify-between items-center">
                                <span className="text-[9px] text-zinc-400 uppercase font-bold">{label}</span>
                                <button onClick={() => setGlobalSettings(p => ({...p, [isDrone ? 'droneEnabled' : 'noiseEnabled']: !enabled}))} className={`text-[8px] uppercase ${enabled ? 'text-[#06b6d4]' : 'text-zinc-600'}`}>{enabled ? 'Active' : 'Muted'}</button>
                            </div>
                            <input type="range" min="0" max="1" step="0.01" value={vol} onChange={(e) => setGlobalSettings(p => ({...p, [isDrone ? 'droneVolume' : 'noiseVolume']: parseFloat(e.target.value)}))} className="w-full accent-[#06b6d4]" />
                        </div>
                     )
                 })}
              </div>

              {/* HARMONICS */}
              <div className="p-4 space-y-4">
                  <label className="text-[9px] font-bold text-zinc-500 tracking-widest flex items-center gap-2"><Settings2 size={10} /> HARMONICS</label>
                  <div className="grid grid-cols-4 gap-1">
                      {KEYS.map(k => (
                          <button key={k} onClick={() => setGlobalSettings(p => ({...p, rootKey: k}))} className={`h-6 text-[9px] font-bold border ${globalSettings.rootKey === k ? 'bg-[#ec4899] border-[#ec4899] text-white' : 'bg-[#121215] border-[#27272a] text-zinc-600'}`}>{k}</button>
                      ))}
                  </div>
                  <select value={globalSettings.scale} onChange={(e) => setGlobalSettings(p => ({...p, scale: e.target.value as MusicalScale}))} className="w-full bg-[#121215] border border-[#27272a] text-xs text-zinc-300 p-1 font-mono uppercase">
                      {SCALES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <div className="space-y-1 pt-2">
                     <span className="text-[9px] text-zinc-500 uppercase font-bold">Analog Drift: {Math.round(globalSettings.analogDrift * 100)}%</span>
                     <input type="range" min="0" max="0.5" step="0.01" value={globalSettings.analogDrift} onChange={(e) => setGlobalSettings(p => ({...p, analogDrift: parseFloat(e.target.value)}))} className="w-full accent-[#ec4899]" />
                 </div>
              </div>
          </aside>

          {/* MAIN GRID */}
          <main className="flex-1 bg-[#09090b] p-6 overflow-y-auto relative">
              <div className="absolute inset-0 bg-grid-pattern opacity-20 pointer-events-none fixed"></div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6 relative z-10 pb-20">
                  {simulationConfigs.map(config => (
                      <SimulationCard key={config.id} config={config} globalSettings={globalSettings} onUpdateConfig={handleUpdateConfig} triggerGlitch={glitchTrigger} />
                  ))}
              </div>
          </main>
      </div>

      {/* FLUX RIG PANEL */}
      <FluxRig onToggle={setShowFluxRig} active={showFluxRig} />
    </div>
  );
};

export default App;
