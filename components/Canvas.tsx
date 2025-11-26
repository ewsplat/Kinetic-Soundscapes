
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useRef, useEffect } from 'react';
import { SimulationConfig, GlobalSettings, Ball, Vector2 } from '../types';
import { generatePolygon, generateStar, add, mult, dot, sub, normalize, mag, limitVector, checkEuclideanStep } from '../utils/math';
import { audio } from '../utils/audio';
import { getFrequencyFromScale } from '../utils/music';

interface CanvasProps {
  config: SimulationConfig;
  globalSettings: GlobalSettings;
  volumeMultiplier?: number;
  triggerGlitch?: number;
}

interface Impact {
    pos: Vector2;
    life: number;
    radius: number;
    isGhost: boolean;
}

interface Boid {
    pos: Vector2;
    vel: Vector2;
    acc: Vector2;
}

const Canvas: React.FC<CanvasProps> = ({ config, globalSettings, volumeMultiplier = 1.0, triggerGlitch = 0 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const impactsRef = useRef<Impact[]>([]);
  
  // Refs for state that needs to be accessed inside the worker/timer closure without stale values
  const settingsRef = useRef(globalSettings);
  const volumeRef = useRef(volumeMultiplier);
  const configRef = useRef(config);
  const glitchRef = useRef(0);
  const flockStepRef = useRef(0);
  const pulseRef = useRef<number>(0);
  const currentGravityRef = useRef<number>(0);

  // Initialize state refs
  useEffect(() => { settingsRef.current = globalSettings; }, [globalSettings]);
  useEffect(() => { volumeRef.current = volumeMultiplier; }, [volumeMultiplier]);
  useEffect(() => { configRef.current = config; }, [config]);
  useEffect(() => { if (triggerGlitch > 0) glitchRef.current = 1.0; }, [triggerGlitch]);

  // Physics state
  const stateRef = useRef<{
    balls: Ball[];
    boids: Boid[];
    rotation: number;
    mousePos: Vector2 | null;
    isMouseDown: boolean;
    startTime: number;
  }>({
    balls: [], 
    boids: [], 
    rotation: 0, 
    mousePos: null, 
    isMouseDown: false, 
    startTime: Date.now()
  });

  // Re-initialize entities when config changes majorly
  useEffect(() => {
    const balls: Ball[] = [];
    for (let i = 0; i < Math.floor(config.ballCount); i++) {
      balls.push({
        id: `${config.id}-${i}`,
        pos: { x: Math.cos(Math.random()*Math.PI*2) * 20, y: Math.sin(Math.random()*Math.PI*2) * 20 },
        vel: { x: (Math.random()-0.5)*config.initialSpeed, y: (Math.random()-0.5)*config.initialSpeed },
        radius: config.ballSize,
        color: config.themeColor,
        trail: [] 
      });
    }
    
    const boids: Boid[] = [];
    if (config.flock.enabled) {
        for(let i=0; i<config.flock.boidCount; i++) {
             boids.push({
                 pos: { x: (Math.random()-0.5)*100, y: (Math.random()-0.5)*100 },
                 vel: { x: (Math.random()-0.5)*config.flock.maxSpeed, y: (Math.random()-0.5)*config.flock.maxSpeed },
                 acc: { x:0, y:0 }
             });
        }
    }
    stateRef.current.balls = balls;
    stateRef.current.boids = boids;
  }, [config.id, config.ballCount, config.themeColor, config.flock.enabled, config.flock.boidCount, config.initialSpeed]);

  const handleImpact = (pos: Vector2, speed: number, wallIndex: number, width: number, height: number, type: 'ball' | 'boid') => {
      const conf = configRef.current;
      
      // PROBABILITY GATE
      const prob = conf.instrument.probability ?? 1.0;
      const shouldPlay = Math.random() <= prob;

      impactsRef.current.push({
          pos: { ...pos },
          life: 1.0,
          radius: type === 'ball' ? (5 + speed * 1.5) : 3,
          isGhost: !shouldPlay
      });

      if (!shouldPlay) return;

      if (type === 'ball') pulseRef.current = Math.min(pulseRef.current + 0.4, 1.2);

      if (settingsRef.current.isPlaying && volumeRef.current > 0) {
          if (type === 'boid') {
              flockStepRef.current = (flockStepRef.current + 1) % (conf.flock.euclideanSteps || 16);
              if (checkEuclideanStep(flockStepRef.current, conf.flock.euclideanHits || 4, conf.flock.euclideanSteps || 16)) {
                  const shapeRadius = Math.min(width, height) * 0.42;
                  audio.triggerDrum('glitch', volumeRef.current * 0.7, Math.max(-1, Math.min(1, pos.x / shapeRadius)));
              }
              return;
          }

          let scaleDegree = wallIndex * 2; 
          if (Math.random() > 0.96) scaleDegree += 7; 
          
          const freq = getFrequencyFromScale(
              settingsRef.current.rootKey, 
              settingsRef.current.scale, 
              conf.instrument.baseOctave, 
              scaleDegree,
              settingsRef.current.analogDrift
          );
          
          const velocity = Math.min(Math.max(speed / 6, 0.2), 1.2) * volumeRef.current;
          const shapeRadius = Math.min(width, height) * 0.42;
          
          audio.trigger(conf.instrument, freq, velocity, {
              x: Math.max(-1, Math.min(1, pos.x / shapeRadius)),
              y: Math.max(-1, Math.min(1, pos.y / shapeRadius))
          });
      }
  };

  const updatePhysics = (width: number, height: number) => {
    const state = stateRef.current;
    const settings = settingsRef.current;
    const conf = configRef.current;
    
    // Clean up dead impacts
    for (let i = impactsRef.current.length - 1; i >= 0; i--) {
        impactsRef.current[i].life -= 0.05;
        if (impactsRef.current[i].life <= 0) {
            impactsRef.current.splice(i, 1);
        }
    }

    if (settings.timeScale === 0) return;

    const shapeRadius = Math.min(width, height) * 0.42;
    pulseRef.current *= 0.94;
    
    if (glitchRef.current > 0.01) glitchRef.current *= 0.92; 
    else glitchRef.current = 0;

    state.rotation += conf.rotationSpeed * settings.rotationMultiplier * settings.timeScale;
    
    let effectiveGravity = conf.gravity * settings.gravityMultiplier;
    if (settings.gravityLfoEnabled) {
        const beatDur = 60000 / settings.bpm;
        const period = beatDur * (1 / settings.gravityLfoRate);
        const now = Date.now();
        const phase = ((now - state.startTime) % period) / period;
        const lfo = Math.sin(phase * Math.PI * 2);
        effectiveGravity += (lfo * 0.35);
    }
    currentGravityRef.current = effectiveGravity;

    const vertices = conf.shapeType === 'star' 
        ? generateStar(conf.vertexCount||5, shapeRadius, shapeRadius*0.4, {x:0,y:0}, state.rotation)
        : generatePolygon(conf.vertexCount||4, shapeRadius, {x:0,y:0}, state.rotation);

    state.balls.forEach(ball => {
        if (!ball.trail) ball.trail = [];
        const jitter = { x: (Math.random()-0.5)*2, y: (Math.random()-0.5)*2 };
        ball.trail.push(add(ball.pos, jitter));
        if (ball.trail.length > 8) ball.trail.shift();

        // Gravity
        ball.vel.y += effectiveGravity * settings.timeScale;
        
        // Chaos / Turbulence
        if (conf.instrument.chaos && conf.instrument.chaos > 0) {
            const chaosForce = conf.instrument.chaos * 0.5 * settings.timeScale;
            ball.vel.x += (Math.random() - 0.5) * chaosForce;
            ball.vel.y += (Math.random() - 0.5) * chaosForce;
        }
        
        // Mouse Interaction
        if (state.mousePos && state.isMouseDown) {
            const dx = ball.pos.x - state.mousePos.x;
            const dy = ball.pos.y - state.mousePos.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            if (dist < 300 && dist > 1) {
                const force = (3000 / (dist + 5)) * settings.timeScale * (settings.mouseForceMode === 'attract' ? -1 : 1);
                ball.vel.x += (dx/dist) * force * 0.15; 
                ball.vel.y += (dy/dist) * force * 0.15;
            }
        }

        ball.vel = mult(ball.vel, 1 - conf.friction * settings.timeScale);
        ball.pos = add(ball.pos, mult(ball.vel, settings.timeScale));

        // Wall Collisions
        for (let i = 0; i < vertices.length; i++) {
            const p1 = vertices[i];
            const p2 = vertices[(i + 1) % vertices.length];
            const edge = sub(p2, p1);
            const normal = normalize({ x: -edge.y, y: edge.x });
            const relPos = sub(ball.pos, p1);
            const dist = dot(relPos, normal);
            
            if (dist < ball.radius) {
                ball.pos = add(ball.pos, mult(normal, ball.radius - dist));

                const vDotN = dot(ball.vel, normal);
                if (vDotN < 0) {
                    const now = performance.now();
                    if (!ball.lastImpactTime || now - ball.lastImpactTime > 80) { 
                         handleImpact(add(ball.pos, mult(normal, -ball.radius)), mag(ball.vel), i, width, height, 'ball');
                         ball.lastImpactTime = now;
                    }

                    const reflect = mult(normal, 2 * vDotN);
                    ball.vel = mult(sub(ball.vel, reflect), conf.restitution);
                }
            }
        }
    });

    // Boids
    if (config.flock.enabled) {
         const { perceptionRadius, maxForce, maxSpeed, separationWeight, alignmentWeight, cohesionWeight } = config.flock;
         state.boids.forEach(boid => {
             let steering = { x:0, y:0 };
             let total = 0;
             let align = { x:0, y:0 };
             let cohesion = { x:0, y:0 };
             let separation = { x:0, y:0 };
             
             state.boids.forEach(other => {
                 const d = mag(sub(boid.pos, other.pos));
                 if (other !== boid && d < perceptionRadius) {
                     align = add(align, other.vel);
                     cohesion = add(cohesion, other.pos);
                     const diff = sub(boid.pos, other.pos);
                     separation = add(separation, mult(diff, 1/(d*d))); 
                     total++;
                 }
             });

             if (total > 0) {
                 align = mult(align, 1/total);
                 align = sub(mult(normalize(align), maxSpeed), boid.vel);
                 align = limitVector(align, maxForce);

                 cohesion = mult(cohesion, 1/total);
                 cohesion = sub(cohesion, boid.pos);
                 cohesion = sub(mult(normalize(cohesion), maxSpeed), boid.vel);
                 cohesion = limitVector(cohesion, maxForce);

                 separation = mult(separation, 1/total);
                 separation = sub(mult(normalize(separation), maxSpeed), boid.vel);
                 separation = limitVector(separation, maxForce);
             }

             boid.acc = add(boid.acc, mult(align, alignmentWeight));
             boid.acc = add(boid.acc, mult(cohesion, cohesionWeight));
             boid.acc = add(boid.acc, mult(separation, separationWeight));
             
             const centerDir = sub({x:0, y:0}, boid.pos);
             boid.acc = add(boid.acc, mult(normalize(centerDir), 0.01));

             state.balls.forEach(ball => {
                 const d = mag(sub(boid.pos, ball.pos));
                 if (d < ball.radius + 15) {
                     const flee = normalize(sub(boid.pos, ball.pos));
                     boid.acc = add(boid.acc, mult(flee, 0.5));
                     const now = performance.now();
                     if (Math.random() > 0.95 && settings.isPlaying) {
                         const shapeRadius = Math.min(width, height) * 0.42;
                         audio.triggerDrum('808', volumeRef.current * 0.8, Math.max(-1, Math.min(1, boid.pos.x/shapeRadius)));
                         impactsRef.current.push({ pos: {...boid.pos}, life: 0.5, radius: 2, isGhost: false });
                     }
                 }
             });

             boid.vel = add(boid.vel, boid.acc);
             boid.vel = limitVector(boid.vel, maxSpeed);
             boid.pos = add(boid.pos, mult(boid.vel, settings.timeScale));
             boid.acc = { x:0, y:0 }; 

             const dist = mag(boid.pos);
             if (dist > shapeRadius) {
                 const normal = mult(normalize(boid.pos), -1);
                 boid.vel = add(boid.vel, mult(normal, 2));
                 
                 if (Math.random() > 0.98) { 
                    handleImpact(boid.pos, mag(boid.vel), 0, width, height, 'boid');
                 }
             }
         });
    }
  };

  const draw = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.clearRect(0, 0, width, height);
    const center = { x: width/2, y: height/2 };
    const conf = configRef.current;
    
    // Glitch Shake
    if (glitchRef.current > 0.01) {
        const shake = glitchRef.current * 10;
        ctx.translate((Math.random()-0.5)*shake, (Math.random()-0.5)*shake);
        ctx.fillStyle = `rgba(234, 88, 12, ${glitchRef.current * 0.2})`;
        ctx.fillRect(0,0,width,height);
    }

    // Draw Shape
    let vertices = conf.shapeType === 'star' 
        ? generateStar(conf.vertexCount||5, Math.min(width,height)*0.42, Math.min(width,height)*0.16, center, stateRef.current.rotation)
        : generatePolygon(conf.vertexCount||4, Math.min(width,height)*0.42, center, stateRef.current.rotation);
    
    ctx.beginPath();
    if (vertices.length) { 
        ctx.moveTo(vertices[0].x, vertices[0].y); 
        vertices.slice(1).forEach(v => ctx.lineTo(v.x, v.y)); 
        ctx.closePath(); 
    }
    ctx.strokeStyle = conf.themeColor;
    ctx.lineWidth = 2 + pulseRef.current * 4;
    ctx.stroke();

    // Gravity visualization
    if (settingsRef.current.gravityLfoEnabled) {
        const g = currentGravityRef.current;
        const gMag = Math.abs(g);
        const gDir = g > 0 ? 1 : -1;
        ctx.save();
        ctx.translate(center.x, center.y);
        ctx.fillStyle = gDir > 0 ? 'rgba(255, 255, 255, 0.1)' : 'rgba(234, 88, 12, 0.2)';
        ctx.fillRect(width * 0.4, -gMag * 50 * gDir, 4, gMag * 50 * gDir); 
        
        ctx.beginPath();
        const arrowY = -gMag * 50 * gDir;
        ctx.moveTo(width * 0.4 - 3, arrowY);
        ctx.lineTo(width * 0.4 + 7, arrowY);
        ctx.lineTo(width * 0.4 + 2, arrowY - (5 * gDir));
        ctx.fill();
        ctx.restore();
    }

    // Draw Impacts
    impactsRef.current.forEach(imp => {
        const x = center.x + imp.pos.x;
        const y = center.y + imp.pos.y;
        ctx.beginPath();
        ctx.arc(x, y, Math.max(0, imp.radius * (2 - imp.life)), 0, Math.PI*2);
        
        if (imp.isGhost) {
            ctx.strokeStyle = 'rgba(100,100,100,0.5)';
            ctx.setLineDash([2, 4]);
            ctx.stroke();
            ctx.setLineDash([]);
        } else {
            ctx.fillStyle = conf.themeColor;
            ctx.globalAlpha = imp.life;
            ctx.fill();
            ctx.globalAlpha = 1.0;
        }
    });

    // Draw Balls
    stateRef.current.balls.forEach(ball => {
        const x = center.x + ball.pos.x;
        const y = center.y + ball.pos.y;

        // Trail
        if (ball.trail && ball.trail.length > 1) {
            ctx.beginPath();
            ball.trail.forEach((t, i) => {
                const tx = center.x + t.x;
                const ty = center.y + t.y;
                if (i===0) ctx.moveTo(tx, ty); else ctx.lineTo(tx, ty);
            });
            ctx.strokeStyle = ball.color;
            ctx.lineWidth = 1;
            ctx.globalAlpha = 0.4;
            ctx.stroke();
            ctx.globalAlpha = 1.0;
        }

        // Ball Body - Squash & Stretch
        const velocity = mag(ball.vel);
        const angle = Math.atan2(ball.vel.y, ball.vel.x);
        const stretch = Math.min(1.5, 1 + velocity * 0.05);
        const squash = 1 / stretch;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.scale(stretch, squash);
        ctx.beginPath();
        ctx.arc(0, 0, ball.radius, 0, Math.PI*2);
        ctx.fillStyle = ball.color;
        
        // Glow
        ctx.shadowColor = ball.color;
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;
        
        // Shine
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.beginPath();
        ctx.arc(-ball.radius*0.3, -ball.radius*0.3, ball.radius*0.3, 0, Math.PI*2);
        ctx.fill();
        
        ctx.restore();
    });

    // Draw Boids
    if (config.flock.enabled) {
        stateRef.current.boids.forEach(boid => {
            const x = center.x + boid.pos.x;
            const y = center.y + boid.pos.y;
            const angle = Math.atan2(boid.vel.y, boid.vel.x);
            
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(angle);
            
            ctx.beginPath();
            ctx.moveTo(6, 0);
            ctx.lineTo(-4, 3);
            ctx.lineTo(-4, -3);
            ctx.closePath();
            
            ctx.fillStyle = config.flock.color;
            ctx.fill();
            ctx.restore();
        });
    }

    // Constellations (Connections)
    if (stateRef.current.balls.length > 1) {
        ctx.strokeStyle = `rgba(255,255,255,0.1)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i=0; i<stateRef.current.balls.length; i++) {
            for (let j=i+1; j<stateRef.current.balls.length; j++) {
                const b1 = stateRef.current.balls[i];
                const b2 = stateRef.current.balls[j];
                const d = mag(sub(b1.pos, b2.pos));
                if (d < 60) {
                     ctx.moveTo(center.x + b1.pos.x, center.y + b1.pos.y);
                     ctx.lineTo(center.x + b2.pos.x, center.y + b2.pos.y);
                }
            }
        }
        ctx.stroke();
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderFrameId: number;
    let worker: Worker | null = null;

    // Use a Web Worker to tick the physics loop even in background tabs
    const workerScript = `
        let intervalId;
        self.onmessage = (e) => {
            if (e.data === 'start') {
                intervalId = setInterval(() => postMessage('tick'), 1000 / 60);
            } else if (e.data === 'stop') {
                clearInterval(intervalId);
            }
        };
    `;
    
    try {
        const blob = new Blob([workerScript], { type: 'application/javascript' });
        worker = new Worker(URL.createObjectURL(blob));
        
        worker.onmessage = () => {
            if (canvasRef.current) {
                updatePhysics(canvasRef.current.width, canvasRef.current.height);
            }
        };
        worker.postMessage('start');
    } catch (e) {
        console.warn("Web Worker failed to initialize, falling back to main thread rAF only.", e);
    }

    const renderLoop = () => {
        if (canvas) {
            // Ensure resolution matches display
            const rect = canvas.getBoundingClientRect();
            if (canvas.width !== rect.width || canvas.height !== rect.height) {
                canvas.width = rect.width;
                canvas.height = rect.height;
            }
            // If worker failed, run physics here as fallback
            if (!worker) {
                updatePhysics(canvas.width, canvas.height);
            }
            draw(canvas.getContext('2d')!, canvas.width, canvas.height);
        }
        renderFrameId = requestAnimationFrame(renderLoop);
    };
    renderLoop();

    const handleInteract = (e: MouseEvent | TouchEvent) => {
        const rect = canvas.getBoundingClientRect();
        const clientX = 'touches' in e ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
        const clientY = 'touches' in e ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;
        // Map to center-relative coords
        stateRef.current.mousePos = {
            x: clientX - rect.left - rect.width/2,
            y: clientY - rect.top - rect.height/2
        };
        stateRef.current.isMouseDown = true;
    };
    
    const stopInteract = () => {
        stateRef.current.isMouseDown = false;
        stateRef.current.mousePos = null;
    };

    canvas.addEventListener('mousedown', handleInteract);
    canvas.addEventListener('mousemove', (e) => stateRef.current.isMouseDown && handleInteract(e));
    canvas.addEventListener('mouseup', stopInteract);
    canvas.addEventListener('mouseleave', stopInteract);
    canvas.addEventListener('touchstart', handleInteract, {passive: false});
    canvas.addEventListener('touchmove', handleInteract, {passive: false});
    canvas.addEventListener('touchend', stopInteract);

    return () => {
        cancelAnimationFrame(renderFrameId);
        if (worker) {
            worker.postMessage('stop');
            worker.terminate();
        }
        canvas.removeEventListener('mousedown', handleInteract);
        canvas.removeEventListener('mousemove', handleInteract);
        canvas.removeEventListener('mouseup', stopInteract);
        canvas.removeEventListener('mouseleave', stopInteract);
        canvas.removeEventListener('touchstart', handleInteract);
        canvas.removeEventListener('touchmove', handleInteract);
        canvas.removeEventListener('touchend', stopInteract);
    };
  }, []);

  return <canvas ref={canvasRef} className="w-full h-full relative z-10" />;
};

export default Canvas;
