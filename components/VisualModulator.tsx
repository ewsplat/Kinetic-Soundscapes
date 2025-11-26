
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useRef, useEffect, useState } from 'react';
import { audio } from '../utils/audio';
import { Camera, FileVideo, Image as ImageIcon, Upload, Eye, EyeOff } from 'lucide-react';

const PLACEHOLDER_SOURCES = [
    "https://upload.wikimedia.org/wikipedia/commons/c/c0/Big_Buck_Bunny_4K.webm",
    "https://upload.wikimedia.org/wikipedia/commons/2/2c/Rotating_earth_%28large%29.gif",
    "https://upload.wikimedia.org/wikipedia/commons/6/6e/Golfer_swing.gif",
    "https://upload.wikimedia.org/wikipedia/commons/f/f7/Nuage_d_orage_time_lapse_antibes.gif"
];

type SourceType = 'placeholder' | 'camera' | 'file';

const VisualModulator: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);
    const [sourceType, setSourceType] = useState<SourceType>('placeholder');
    const [activeUrl, setActiveUrl] = useState<string>('');
    const [isVideoMode, setIsVideoMode] = useState<boolean>(true);
    const [isEnabled, setIsEnabled] = useState(true);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const requestRef = useRef<number | null>(null);
    
    // Analysis State
    const prevFrameRef = useRef<Uint8ClampedArray | null>(null);

    // Initial Load
    useEffect(() => {
        loadRandomPlaceholder();
    }, []);

    const loadRandomPlaceholder = () => {
        const rawUrl = PLACEHOLDER_SOURCES[Math.floor(Math.random() * PLACEHOLDER_SOURCES.length)];
        // Add cache buster to ensure CORS headers are fresh
        const urlWithCache = rawUrl.startsWith('blob:') ? rawUrl : `${rawUrl}?t=${Date.now()}`;
        
        setActiveUrl(urlWithCache);
        setSourceType('placeholder');
        
        const isVideo = rawUrl.match(/\.(webm|mp4)/i) !== null;
        setIsVideoMode(isVideo);
        
        if (isVideo && videoRef.current) {
            videoRef.current.src = urlWithCache;
            videoRef.current.play().catch(e => console.log("Autoplay blocked", e));
        }
    };

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play();
                setSourceType('camera');
                setIsVideoMode(true);
                setActiveUrl('');
            }
        } catch (e) {
            console.error("Camera access denied", e);
        }
    };

    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (activeUrl && activeUrl.startsWith('blob:')) URL.revokeObjectURL(activeUrl);

            const url = URL.createObjectURL(file);
            
            // Robust type checking
            const isVideo = file.type.startsWith('video') || !!file.name.match(/\.(mp4|webm|mov|mkv)$/i);
            
            // Update state in batch
            setActiveUrl(url);
            setSourceType('file');
            setIsVideoMode(isVideo);

            // Immediate DOM updates if needed
            if (isVideo && videoRef.current) {
                videoRef.current.srcObject = null;
                videoRef.current.src = url;
                videoRef.current.play();
                videoRef.current.loop = true;
            } else if (videoRef.current) {
                videoRef.current.pause();
                videoRef.current.src = "";
                videoRef.current.srcObject = null;
            }
            e.target.value = '';
        }
    };

    const processFrame = () => {
        if (!isEnabled) return;

        // --- GIF / IMAGE MODE (Synthetic Modulation - Ghost LFO) ---
        // We cannot reliably analyze GIF pixels in real-time on canvas without parsing libraries.
        // We simulate the modulation to keep the audio "alive".
        if (!isVideoMode && sourceType !== 'camera') {
            const t = Date.now() / 1000;
            
            // Ghost Motion: Erratic, twitchy sine waves to mimic GIF loops
            // Mix of fast jitter and slow undulation
            const noise = Math.random() * 0.15;
            const baseLfo = Math.sin(t * 8) * 0.5 + 0.5; // Fast pulse
            const ghostMotion = Math.min(1.0, (baseLfo * 0.4) + noise + 0.1);

            // Ghost Brightness: Slow breathing
            const ghostLum = (Math.sin(t * 0.6) * 0.3) + 0.5;

            // Ghost Hue: Slow drift
            const ghostHue = (t * 12) % 360;

            audio.updateVisualModulation(ghostMotion, ghostLum, ghostHue);
            
            requestRef.current = requestAnimationFrame(processFrame);
            return;
        }

        // --- VIDEO / CAMERA MODE (Real Pixel Analysis & Dither) ---
        const canvas = canvasRef.current;
        const source = videoRef.current;
        
        if (!canvas || !source) {
            requestRef.current = requestAnimationFrame(processFrame);
            return;
        }
        
        if (source.readyState < 2) {
             requestRef.current = requestAnimationFrame(processFrame);
             return;
        }

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;

        const w = 128;
        const h = 96;
        
        try {
            // If this throws CORS error, we catch it without disabling the engine
            ctx.drawImage(source, 0, 0, w, h);
        } catch (e) {
            requestRef.current = requestAnimationFrame(processFrame);
            return; 
        }
        
        const frameData = ctx.getImageData(0, 0, w, h);
        const data = frameData.data;
        const currentRawFrame = new Uint8ClampedArray(data);
        
        const len = data.length;
        let totalLum = 0;
        let totalR = 0; let totalG = 0; let totalB = 0;
        let motionSum = 0;

        for (let i = 0; i < len; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            totalLum += lum;
            totalR += r; totalG += g; totalB += b;

            // Motion Calc: Compare current RAW pixel to previous RAW pixel
            if (prevFrameRef.current) {
                const diff = Math.abs(g - prevFrameRef.current[i+1]);
                if (diff > 20) motionSum += diff;
            }

            // Dither Effect for Display
            const threshold = 128 + (Math.random() - 0.5) * 40;
            const finalPixel = lum > threshold ? 255 : 0;
            
            data[i] = finalPixel;
            data[i+1] = finalPixel;
            data[i+2] = finalPixel;
        }

        prevFrameRef.current = currentRawFrame;
        ctx.putImageData(frameData, 0, 0);

        const pixelCount = w * h;
        const avgLum = totalLum / pixelCount / 255;
        const avgMotion = Math.min(1.0, (motionSum / pixelCount) / 100); 
        
        const avgR = totalR / pixelCount;
        const avgG = totalG / pixelCount;
        const avgB = totalB / pixelCount;
        const hue = Math.atan2(Math.sqrt(3) * (avgG - avgB), 2 * avgR - avgG - avgB) * (180 / Math.PI);
        
        audio.updateVisualModulation(avgMotion, avgLum, (hue + 360) % 360);

        requestRef.current = requestAnimationFrame(processFrame);
    };

    useEffect(() => {
        requestRef.current = requestAnimationFrame(processFrame);
        return () => { if(requestRef.current) cancelAnimationFrame(requestRef.current); };
    }, [isEnabled, sourceType, isVideoMode]);

    return (
        <div className="panel-brutal bg-[#09090b] flex flex-col p-4 border-b border-[#27272a] gap-4 relative overflow-hidden">
            <div className="flex justify-between items-center z-20">
                 <label className="text-[9px] font-bold text-zinc-500 tracking-widest flex items-center gap-2">
                    <Eye size={10} className="text-[#ea580c]" /> VISUAL CORE
                 </label>
                 <button onClick={() => setIsEnabled(!isEnabled)} className={`text-[8px] border px-1 uppercase ${isEnabled ? 'border-[#06b6d4] text-[#06b6d4]' : 'border-zinc-700 text-zinc-600'}`}>
                    {isEnabled ? 'ACTIVE' : 'OFFLINE'}
                 </button>
            </div>

            <div className="relative aspect-video bg-black border border-[#27272a] overflow-hidden group z-10">
                
                {/* 1. VIDEO SOURCE (Hidden in UI, analyzed by Canvas) */}
                <video 
                    ref={videoRef} 
                    crossOrigin="anonymous"
                    playsInline 
                    muted 
                    loop 
                    className="absolute inset-0 w-full h-full object-cover opacity-0 pointer-events-none z-0"
                />

                {/* 2. GIF SOURCE (Visible for display if GIF mode) */}
                {/* CSS Gritting: High Contrast + Grayscale to mimic dither */}
                <img
                    key={activeUrl} // Force remount on URL change to restart GIF
                    ref={imgRef}
                    src={!isVideoMode && sourceType !== 'camera' ? activeUrl : undefined}
                    crossOrigin="anonymous"
                    className={`absolute inset-0 w-full h-full object-contain image-pixelated filter grayscale contrast-[1.5] brightness-110 z-10 ${isVideoMode || sourceType === 'camera' ? 'hidden' : 'block'}`}
                    alt="analysis-source"
                />

                {/* 3. CANVAS (Visible for display if Video/Camera mode) */}
                <canvas 
                    ref={canvasRef} 
                    width={128} 
                    height={96} 
                    className={`w-full h-full object-contain image-pixelated opacity-90 relative z-20 ${!isVideoMode && sourceType !== 'camera' ? 'hidden' : 'block'}`} 
                />
                
                {/* Overlays */}
                <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%] bg-repeat z-30"></div>
                <div className="absolute top-1 left-1 text-[8px] font-mono text-[#ea580c] bg-black/50 px-1 z-40">
                    SRC: {sourceType.toUpperCase()} {isVideoMode ? '(VID)' : '(IMG)'}
                </div>
            </div>

            <div className="grid grid-cols-3 gap-1 z-20">
                <button 
                    onClick={loadRandomPlaceholder}
                    className={`btn-retro h-6 flex items-center justify-center gap-1 ${sourceType === 'placeholder' ? 'text-white border-zinc-500' : ''}`}
                >
                    <ImageIcon size={10} /> <span className="text-[8px]">RND</span>
                </button>

                <button 
                    onClick={startCamera}
                    className={`btn-retro h-6 flex items-center justify-center gap-1 ${sourceType === 'camera' ? 'text-[#ea580c] border-[#ea580c]' : ''}`}
                >
                    <Camera size={10} /> <span className="text-[8px]">CAM</span>
                </button>

                <button 
                    onClick={() => fileInputRef.current?.click()}
                    className={`btn-retro h-6 flex items-center justify-center gap-1 ${sourceType === 'file' ? 'text-[#06b6d4] border-[#06b6d4]' : ''}`}
                >
                    <Upload size={10} /> <span className="text-[8px]">FILE</span>
                </button>
            </div>
            
            <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFile} 
                accept="video/*,image/gif,image/webp,image/png,image/jpeg" 
                className="hidden" 
            />
        </div>
    );
};

export default VisualModulator;
