
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useRef, useEffect } from 'react';
import { audio } from '../utils/audio';

const MasterVisualizer: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const requestRef = useRef<number | null>(null);

    const draw = () => {
        const canvas = canvasRef.current;
        const analyser = audio.analyser;
        if (!canvas || !analyser) {
             requestRef.current = requestAnimationFrame(draw);
             return;
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const w = canvas.width;
        const h = canvas.height;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        // We switch between TimeDomain (Oscilloscope) and Frequency (Spectrum) randomly or mixed?
        // Let's do Oscilloscope for that sci-fi look
        analyser.getByteTimeDomainData(dataArray);

        ctx.fillStyle = '#09090b';
        ctx.fillRect(0, 0, w, h);

        // Grid
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.beginPath();
        for(let x=0; x<w; x+=20) { ctx.moveTo(x,0); ctx.lineTo(x,h); }
        for(let y=0; y<h; y+=20) { ctx.moveTo(0,y); ctx.lineTo(w,y); }
        ctx.stroke();

        ctx.lineWidth = 2;
        ctx.strokeStyle = '#84cc16'; // Acid Green
        ctx.shadowBlur = 4;
        ctx.shadowColor = '#84cc16';

        ctx.beginPath();
        const sliceWidth = w * 1.0 / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = (v * h) / 2;

            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);

            x += sliceWidth;
        }

        ctx.lineTo(w, h / 2);
        ctx.stroke();
        
        ctx.shadowBlur = 0;

        requestRef.current = requestAnimationFrame(draw);
    };

    useEffect(() => {
        requestRef.current = requestAnimationFrame(draw);
        return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
    }, []);

    return (
        <div className="h-10 w-48 bg-[#09090b] border border-[#27272a] relative overflow-hidden hidden md:block">
            <div className="absolute inset-0 scanline-overlay z-20 pointer-events-none"></div>
            <canvas ref={canvasRef} width={192} height={40} className="w-full h-full opacity-80" />
        </div>
    );
};

export default MasterVisualizer;
