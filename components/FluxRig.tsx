
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useRef, useState, useEffect } from 'react';
import { audio } from '../utils/audio';
import { FluxState } from '../types';
import { Power, Zap, Radio, Move, XCircle, Activity } from 'lucide-react';

interface FluxRigProps {
    onToggle: (isActive: boolean) => void;
    active: boolean;
}

const FluxRig: React.FC<FluxRigProps> = ({ onToggle, active }) => {
    const [state, setState] = useState<FluxState>({
        active: false,
        tapeStopVal: 0.5, // 0.5 is Neutral (1.0x speed)
        fracture: false,
        voltage: false,
        dimension: false,
        void: false,
        prismVal: 0,
        gravityX: 0.5,
        gravityY: 0.5
    });

    // Gravity Well Physics State
    const wellPhysics = useRef({
        puckX: 0.5, puckY: 0.5,
        velX: 0, velY: 0,
        cursorX: 0.5, cursorY: 0.5,
        isDragging: false
    });

    const leverRef = useRef<HTMLDivElement>(null);
    const ribbonRef = useRef<HTMLDivElement>(null);
    const gravityRef = useRef<HTMLDivElement>(null);
    const requestRef = useRef<number | null>(null);

    // Animation Loop
    const update = () => {
        // --- GRAVITY WELL PHYSICS ---
        const wp = wellPhysics.current;
        
        if (wp.isDragging) {
            // Puck follows cursor tightly with slight spring
            wp.puckX += (wp.cursorX - wp.puckX) * 0.2;
            wp.puckY += (wp.cursorY - wp.puckY) * 0.2;
            wp.velX = (wp.cursorX - wp.puckX) * 0.1; // Transfer momentum
            wp.velY = (wp.cursorY - wp.puckY) * 0.1;
        } else {
            // Orbit / Bounce Logic
            // Attract to center (0.5, 0.5) slightly to keep it active
            const dx = 0.5 - wp.puckX;
            const dy = 0.5 - wp.puckY;
            wp.velX += dx * 0.001; 
            wp.velY += dy * 0.001;

            // Bounce off walls
            if (wp.puckX < 0 || wp.puckX > 1) wp.velX *= -0.9;
            if (wp.puckY < 0 || wp.puckY > 1) wp.velY *= -0.9;

            wp.puckX += wp.velX;
            wp.puckY += wp.velY;
            
            // Friction
            wp.velX *= 0.98;
            wp.velY *= 0.98;
        }

        // Update React State for visual render
        setState(prev => ({
            ...prev,
            gravityX: wp.puckX,
            gravityY: wp.puckY
        }));

        // Sync Audio Engine
        // Tape Stop: 0.0 = 2x speed, 0.5 = 1x speed, 1.0 = 0x speed
        // Prism: 0-1
        // Gravity X: Decimator (0 = Clean, 1 = Crushed)
        // Gravity Y: Filter (0 = Lowpass Closed, 1 = Open)
        audio.setFluxParams({
            tapeVal: state.tapeStopVal,
            fracture: state.fracture,
            voltage: state.voltage,
            dimension: state.dimension,
            prismVal: state.prismVal,
            gravityX: wp.puckX,
            gravityY: wp.puckY
        });

        if (active) requestRef.current = requestAnimationFrame(update);
    };

    useEffect(() => {
        if (active) {
            requestRef.current = requestAnimationFrame(update);
        } else {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        }
        return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
    }, [active, state.tapeStopVal, state.fracture, state.voltage, state.dimension, state.prismVal]);

    // --- LEVER HANDLING (Sticky) ---
    const handleLeverMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (!leverRef.current) return;
        const rect = leverRef.current.parentElement!.getBoundingClientRect();
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
        const rawY = clientY - rect.top;
        const normY = Math.max(0, Math.min(1, rawY / rect.height));
        setState(p => ({ ...p, tapeStopVal: normY }));
    };
    
    // Double click to reset to center (1.0x)
    const resetLever = () => setState(p => ({ ...p, tapeStopVal: 0.5 }));

    // --- RIBBON HANDLING ---
    const handleRibbonMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (!ribbonRef.current) return;
        const rect = ribbonRef.current.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const normX = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        setState(p => ({ ...p, prismVal: normX }));
    };
    const resetRibbon = () => setState(p => ({ ...p, prismVal: 0 }));

    // --- GRAVITY PAD HANDLING ---
    const handleGravityStart = (e: React.MouseEvent | React.TouchEvent) => {
        wellPhysics.current.isDragging = true;
        handleGravityMove(e);
    };
    
    const handleGravityMove = (e: React.MouseEvent | React.TouchEvent) => {
         if (!gravityRef.current) return;
         const rect = gravityRef.current.getBoundingClientRect();
         const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
         const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
         
         wellPhysics.current.cursorX = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
         wellPhysics.current.cursorY = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    };

    const handleGravityEnd = () => {
        wellPhysics.current.isDragging = false;
        // Add a little "throw" impulse
        // Velocity is already tracked in the loop
    };

    if (!active) return null;

    return (
        <div className="absolute bottom-0 left-0 right-0 h-72 bg-[#121215] border-t-2 border-[#ea580c] z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.8)] flex select-none">
            
            {/* 1. TIME LEVER (Bidirectional) */}
            <div className="w-32 border-r border-[#27272a] p-4 flex flex-col items-center bg-[#09090b] relative group">
                <div className="flex justify-between w-full mb-2 text-[8px] font-bold text-[#ea580c]">
                    <span>FAST</span>
                    <span>STOP</span>
                </div>
                <div 
                    className="flex-1 w-12 bg-[#18181b] border-2 border-[#27272a] relative rounded-md overflow-hidden cursor-ns-resize shadow-inner"
                    onMouseDown={handleLeverMove}
                    onMouseMove={(e) => e.buttons === 1 && handleLeverMove(e)}
                    onTouchStart={handleLeverMove}
                    onTouchMove={handleLeverMove}
                    onDoubleClick={resetLever}
                >
                    {/* Center Line (1.0x) */}
                    <div className="absolute top-1/2 left-0 right-0 h-px bg-white/30 z-0"></div>
                    
                    {/* Fill */}
                    <div className="absolute left-0 right-0 bg-gradient-to-b from-cyan-900/50 via-transparent to-red-900/50 transition-all duration-75" 
                         style={{ 
                             top: state.tapeStopVal > 0.5 ? '50%' : `${state.tapeStopVal * 100}%`, 
                             bottom: state.tapeStopVal < 0.5 ? '50%' : `${(1-state.tapeStopVal) * 100}%` 
                         }}>
                    </div>

                    {/* Handle */}
                    <div ref={leverRef} className="absolute w-full h-8 bg-zinc-300 left-0 border-y-2 border-zinc-500 shadow-xl flex items-center justify-center z-10" 
                         style={{ top: `calc(${state.tapeStopVal * 100}% - 16px)` }}>
                        <div className="w-8 h-1 bg-zinc-400 rounded-full"></div>
                    </div>
                </div>
                <div className="mt-2 text-[9px] font-mono text-zinc-500 text-center">
                    {state.tapeStopVal < 0.45 ? 'HYPER' : state.tapeStopVal > 0.55 ? 'DRAG' : 'SYNC'}
                </div>
            </div>

            {/* 2. PEDALBOARD */}
            <div className="flex-1 p-6 grid grid-cols-4 gap-4 bg-[#101012] relative">
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]"></div>
                
                {[
                    { id: 'fracture', label: 'FRACTURE', icon: Zap, color: 'text-cyan-400', border: 'border-cyan-500', desc: 'BUFFER REPEAT' },
                    { id: 'voltage', label: 'VOLTAGE', icon: Power, color: 'text-red-500', border: 'border-red-500', desc: 'BITCRUSH' },
                    { id: 'dimension', label: 'DIMENSION', icon: Move, color: 'text-purple-400', border: 'border-purple-500', desc: 'STEREO WIDEN' },
                    { id: 'prism', label: 'PRISM', icon: Radio, color: 'text-green-400', border: 'border-green-500', desc: 'RING MOD' },
                ].map(pedal => {
                    const isActive = state[pedal.id as keyof FluxState] as boolean;
                    
                    if (pedal.id === 'prism') return (
                        <div key={pedal.id} className="relative flex flex-col justify-end h-full">
                             <div className="flex-1 bg-[#09090b] border border-zinc-700 relative overflow-hidden cursor-crosshair mb-2 rounded-sm group"
                                ref={ribbonRef}
                                onMouseDown={handleRibbonMove}
                                onMouseMove={(e) => e.buttons === 1 && handleRibbonMove(e)}
                                onMouseUp={resetRibbon}
                                onMouseLeave={resetRibbon}
                                onTouchStart={handleRibbonMove}
                                onTouchMove={handleRibbonMove}
                                onTouchEnd={resetRibbon}
                             >
                                 <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-[10px] font-mono text-green-500/30 tracking-widest group-hover:text-green-500/60 transition-colors">
                                     TOUCH TO WARP
                                 </div>
                                 <div className="absolute top-0 bottom-0 w-1 bg-green-400 shadow-[0_0_15px_currentColor]" style={{ left: `${state.prismVal * 100}%` }}></div>
                             </div>
                             <div className="h-10 bg-[#18181b] border border-green-900/50 flex items-center justify-center text-green-500 font-bold text-xs tracking-widest shadow-[0_0_10px_rgba(34,197,94,0.1)]">
                                 PRISM
                             </div>
                        </div>
                    );

                    return (
                        <button 
                            key={pedal.id}
                            onClick={() => setState(p => ({ ...p, [pedal.id]: !p[pedal.id as keyof FluxState] }))}
                            className={`relative group transition-all duration-75 ${isActive ? 'translate-y-[2px]' : 'hover:-translate-y-1'}`}
                        >
                            <div className={`h-full bg-[#18181b] border-2 ${isActive ? pedal.border : 'border-zinc-700'} rounded-sm flex flex-col items-center justify-center shadow-xl relative overflow-hidden`}>
                                <div className={`absolute top-3 right-3 w-2 h-2 rounded-full ${isActive ? `bg-current shadow-[0_0_10px_currentColor] ${pedal.color}` : 'bg-zinc-900 border border-zinc-800'}`}></div>
                                <pedal.icon size={28} className={`mb-2 ${isActive ? pedal.color : 'text-zinc-700'}`} />
                                <span className={`text-xs font-black tracking-[0.15em] ${isActive ? 'text-white' : 'text-zinc-600'}`}>{pedal.label}</span>
                                <span className="text-[8px] text-zinc-600 mt-1 font-mono">{pedal.desc}</span>
                            </div>
                        </button>
                    )
                })}
            </div>

            {/* 3. GRAVITY WELL (XY) */}
            <div className="w-72 border-l border-[#27272a] bg-[#09090b] p-4 flex flex-col">
                 <div className="flex justify-between items-center mb-2">
                     <span className="text-[9px] font-bold text-zinc-500 tracking-widest flex items-center gap-2">
                        <Activity size={10} className="text-[#ea580c]" /> GRAVITY MOD
                     </span>
                     <div className="text-[8px] text-zinc-600">THROW TO LFO</div>
                 </div>
                 <div 
                    ref={gravityRef}
                    className="flex-1 bg-[#121215] border border-[#27272a] relative overflow-hidden cursor-grab active:cursor-grabbing bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.03)_0%,transparent_70%)]"
                    onMouseDown={handleGravityStart}
                    onMouseMove={(e) => e.buttons === 1 && handleGravityMove(e)}
                    onMouseUp={handleGravityEnd}
                    onMouseLeave={handleGravityEnd}
                    onTouchStart={handleGravityStart}
                    onTouchMove={handleGravityMove}
                    onTouchEnd={handleGravityEnd}
                 >
                     {/* Labels */}
                     <div className="absolute top-1 left-1 text-[8px] text-zinc-700">OPEN</div>
                     <div className="absolute bottom-1 left-1 text-[8px] text-zinc-700">MUFFLE</div>
                     <div className="absolute bottom-1 right-1 text-[8px] text-zinc-700">CRUSH</div>

                     {/* Grid */}
                     <div className="absolute inset-0 bg-grid-pattern opacity-20 pointer-events-none"></div>
                     
                     {/* Puck */}
                     <div 
                        className="absolute w-8 h-8 border-2 border-[#ea580c] bg-[#ea580c]/20 rounded-full -translate-x-1/2 -translate-y-1/2 shadow-[0_0_20px_rgba(234,88,12,0.3)] flex items-center justify-center backdrop-blur-sm"
                        style={{ left: `${state.gravityX * 100}%`, top: `${state.gravityY * 100}%` }}
                     >
                         <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                     </div>
                     
                     {/* Trails/Axis */}
                     <div className="absolute left-0 w-full h-px bg-[#ea580c]/30 pointer-events-none" style={{ top: `${state.gravityY * 100}%` }}></div>
                     <div className="absolute top-0 h-full w-px bg-[#ea580c]/30 pointer-events-none" style={{ left: `${state.gravityX * 100}%` }}></div>
                 </div>
            </div>

            {/* Close Button */}
            <button onClick={() => onToggle(false)} className="absolute -top-8 right-4 h-8 w-8 bg-[#ea580c] text-black flex items-center justify-center hover:bg-white transition-colors shadow-lg">
                <XCircle size={18} />
            </button>
        </div>
    );
};

export default FluxRig;
