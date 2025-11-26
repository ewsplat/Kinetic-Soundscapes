
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useRef, useEffect } from 'react';
import { SimulationConfig, GlobalSettings } from '../types';
import Canvas from './Canvas';
import { Volume2, VolumeX, ChevronLeft, ChevronRight, Dices, Waves, Clock, Zap, Palette, Flame } from 'lucide-react';
import { audio } from '../utils/audio';
import { getNextPatch, getPrevPatch, getRandomPatch, SOUND_LIBRARY } from '../utils/soundLibrary';

interface SimulationCardProps {
  config: SimulationConfig;
  globalSettings: GlobalSettings;
  onUpdateConfig?: (id: number, updates: Partial<SimulationConfig>) => void;
  triggerGlitch?: number;
}

const SimulationCard: React.FC<SimulationCardProps> = ({ config, globalSettings, onUpdateConfig, triggerGlitch }) => {
  const [muted, setMuted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Calculate volume for the visual meter
  const volume = (config.instrument.vol ?? 0.5) * (muted ? 0 : 1);

  // --- AUTO-HEAL ---
  useEffect(() => {
      // Ignore custom sampler/granular types as they won't be in the library
      if (config.instrument.sourceType === 'sampler' || config.instrument.sourceType === 'granular') return;

      const isValid = SOUND_LIBRARY.some(p => p.id === config.instrument.soundId);
      if (!isValid && onUpdateConfig) {
          // Fallback to safe patch if ID is missing
          const safePatch = SOUND_LIBRARY[0];
          onUpdateConfig(config.id, {
              themeColor: safePatch.themeColor,
              instrument: {
                  ...safePatch.config,
                  soundId: safePatch.id,
                  sourceType: 'synth',
                  timbre: 0.5,
                  time: 0.5,
                  color: 0.5,
                  probability: 1.0,
                  drive: 0.0,
              }
          });
      }
  }, [config.instrument.soundId, onUpdateConfig, config.id, config.instrument.sourceType]);

  const currentPatch = SOUND_LIBRARY.find(p => p.id === config.instrument.soundId) || SOUND_LIBRARY[0];

  const loadPatch = (direction: 'next' | 'prev' | 'random') => {
      if (!onUpdateConfig) return;
      let patch;
      if (direction === 'random') patch = getRandomPatch();
      else if (direction === 'next') patch = getNextPatch(config.instrument.soundId);
      else patch = getPrevPatch(config.instrument.soundId);

      onUpdateConfig(config.id, {
          themeColor: patch.themeColor,
          instrument: {
              // Spread patch config LAST to ensure defaults (timbre, color, etc) overwrite old settings
              // except for probability which we want to preserve as a 'sequencer' setting
              ...patch.config, 
              soundId: patch.id,
              probability: config.instrument.probability,
          }
      });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !onUpdateConfig) return;
      try {
          const arrayBuffer = await file.arrayBuffer();
          const audioBuffer = await audio.decodeAudioData(arrayBuffer);
          onUpdateConfig(config.id, {
              instrument: {
                  ...config.instrument,
                  sourceType: 'sampler', // User uploads default to sampler for now
                  sampleBuffer: audioBuffer,
                  sampleUrl: file.name
              }
          });
      } catch (err) {
          console.error("Failed to load sample", err);
      }
  };

  const updateMacro = (key: 'timbre' | 'time' | 'color' | 'probability' | 'drive', val: number) => {
      if(!onUpdateConfig) return;
      onUpdateConfig(config.id, {
          instrument: { ...config.instrument, [key]: val }
      });
  }

  const isGranular = config.instrument.sourceType === 'granular';
  const isSampler = config.instrument.sourceType === 'sampler';

  return (
    <div className="panel-brutal flex flex-col h-full group overflow-hidden bg-[#121215]">
      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="audio/*" className="hidden" />

      {/* INDUSTRIAL HEADER */}
      <div className="flex items-stretch h-8 border-b border-[#27272a]">
         {/* Status LED */}
         <div className="w-8 flex items-center justify-center border-r border-[#27272a] bg-[#09090b]">
             <div className={`w-2 h-2 rounded-full shadow-[0_0_5px_currentColor] ${
                 globalSettings.isPlaying && !muted ? 'bg-green-500 text-green-500' : 'bg-red-900 text-red-900'
             }`}></div>
         </div>

         {/* Title */}
         <div className="flex-1 flex items-center px-3 overflow-hidden bg-[#18181b]">
             <span className="font-mono text-[10px] font-bold tracking-widest uppercase truncate text-zinc-400">
                 MOD_{config.id.toString().padStart(2,'0')} // <span style={{color: !muted ? config.themeColor : '#52525b'}}>{config.name}</span>
             </span>
         </div>

         {/* Action Buttons */}
         <div className="flex">
             <button onClick={() => loadPatch('random')} className="w-8 flex items-center justify-center border-l border-[#27272a] hover:bg-[#27272a] text-zinc-500 hover:text-white transition-colors" title="Randomize Patch">
                <Dices size={12} />
             </button>
             <button onClick={() => setMuted(!muted)} className={`w-8 flex items-center justify-center border-l border-[#27272a] transition-colors ${muted ? 'bg-red-900/20 text-red-500' : 'hover:bg-[#27272a] text-zinc-500'}`} title="Mute">
                {muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
             </button>
         </div>
      </div>

      {/* MAIN CANVAS DISPLAY */}
      <div className="relative aspect-square bg-[#09090b] border-b border-[#27272a]">
         {/* Background Grid */}
         <div className="absolute inset-0 bg-[linear-gradient(to_right,#18181b_1px,transparent_1px),linear-gradient(to_bottom,#18181b_1px,transparent_1px)] bg-[size:20px_20px] opacity-20 pointer-events-none"></div>
         
         {/* Cartridge Overlay (Top Center) */}
         <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 flex items-center gap-0 border border-[#27272a] bg-[#09090b] shadow-lg">
             <button onClick={() => loadPatch('prev')} className="px-1.5 py-1 hover:bg-[#27272a] text-zinc-500"><ChevronLeft size={10} /></button>
             <div className="px-2 py-1 text-[9px] font-mono font-bold tracking-wider uppercase min-w-[80px] text-center text-zinc-300 cursor-pointer hover:text-white" onClick={() => fileInputRef.current?.click()}>
                 {isGranular ? 'GRN: CLOUD' : (isSampler ? 'SMPL: USER' : currentPatch.name)}
             </div>
             <button onClick={() => loadPatch('next')} className="px-1.5 py-1 hover:bg-[#27272a] text-zinc-500"><ChevronRight size={10} /></button>
         </div>

         <Canvas 
             config={config} 
             globalSettings={globalSettings} 
             volumeMultiplier={muted ? 0 : 1} 
             triggerGlitch={triggerGlitch}
         />
      </div>

      {/* MACRO CONTROLS (Fader Bay) */}
      <div className="flex-1 p-3 bg-[#121215] grid grid-cols-5 gap-1.5 items-end">
          
          {/* TIMBRE */}
          <div className="flex flex-col gap-1.5 group">
              <div className="flex justify-between items-end">
                  <span className="text-[7px] font-bold tracking-widest text-zinc-500 group-hover:text-zinc-300">
                    {isGranular ? 'GRAIN' : 'TMBR'}
                  </span>
                  <Waves size={7} className="text-zinc-600 group-hover:text-cyan-400" />
              </div>
              <input 
                type="range" min="0" max="1" step="0.01" 
                value={config.instrument.timbre ?? 0.5}
                onChange={(e) => updateMacro('timbre', parseFloat(e.target.value))}
                className="w-full accent-cyan-500"
              />
          </div>

          {/* TIME */}
          <div className="flex flex-col gap-1.5 group">
              <div className="flex justify-between items-end">
                  <span className="text-[7px] font-bold tracking-widest text-zinc-500 group-hover:text-zinc-300">TIME</span>
                  <Clock size={7} className="text-zinc-600 group-hover:text-pink-400" />
              </div>
              <input 
                type="range" min="0" max="1" step="0.01" 
                value={config.instrument.time ?? 0.5}
                onChange={(e) => updateMacro('time', parseFloat(e.target.value))}
                className="w-full accent-pink-500"
              />
          </div>

          {/* COLOR */}
          <div className="flex flex-col gap-1.5 group">
              <div className="flex justify-between items-end">
                  <span className="text-[7px] font-bold tracking-widest text-zinc-500 group-hover:text-zinc-300">COLR</span>
                  <Palette size={7} className="text-zinc-600 group-hover:text-lime-400" />
              </div>
              <input 
                type="range" min="0" max="1" step="0.01" 
                value={config.instrument.color ?? 0.5}
                onChange={(e) => updateMacro('color', parseFloat(e.target.value))}
                className="w-full accent-lime-500"
              />
          </div>

          {/* DRIVE */}
          <div className="flex flex-col gap-1.5 group">
              <div className="flex justify-between items-end">
                  <span className="text-[7px] font-bold tracking-widest text-zinc-500 group-hover:text-zinc-300">DRIV</span>
                  <Flame size={7} className="text-zinc-600 group-hover:text-orange-400" />
              </div>
              <input 
                type="range" min="0" max="1" step="0.01" 
                value={config.instrument.drive ?? 0.0}
                onChange={(e) => updateMacro('drive', parseFloat(e.target.value))}
                className="w-full accent-orange-500"
              />
          </div>

          {/* PROBABILITY */}
          <div className="flex flex-col gap-1.5 group">
              <div className="flex justify-between items-end">
                  <span className="text-[7px] font-bold tracking-widest text-zinc-500 group-hover:text-zinc-300">PROB</span>
                  <Zap size={7} className="text-zinc-600 group-hover:text-yellow-400" />
              </div>
              <input 
                type="range" min="0" max="1" step="0.05" 
                value={config.instrument.probability ?? 1.0}
                onChange={(e) => updateMacro('probability', parseFloat(e.target.value))}
                className="w-full accent-yellow-500"
              />
          </div>

      </div>
      
      {/* Volume Meter (Decorative) */}
      <div className="h-1 bg-[#09090b] w-full overflow-hidden flex gap-0.5 px-3 pb-3">
          {Array.from({length: 20}).map((_, i) => (
             <div key={i} className="flex-1 h-1 bg-[#27272a] opacity-20"></div>
          ))}
          <div 
            className="absolute h-1 left-3 right-3 bg-gradient-to-r from-transparent via-current to-transparent opacity-30"
            style={{color: config.themeColor, width: `${(volume * 100) * 0.8}%`}}
          ></div>
      </div>
    </div>
  );
};

export default SimulationCard;
