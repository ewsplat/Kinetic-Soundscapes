
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { InstrumentConfig, Vector2, DrumType, RootKey, MusicalScale } from '../types';
import { getFrequencyFromScale } from './music';

class AudioEngine {
  ctx: AudioContext | null = null;
  masterGain: GainNode | null = null;
  masterFilter: BiquadFilterNode | null = null;
  analyser: AnalyserNode | null = null;
  
  // Unified Input Bus (Fixes routing silence)
  preAmpGain: GainNode | null = null;

  // Multiband Compressor Nodes
  lowBand: BiquadFilterNode | null = null;
  midBandHighPass: BiquadFilterNode | null = null; 
  midBandLowPass: BiquadFilterNode | null = null;  
  highBand: BiquadFilterNode | null = null;
  
  lowComp: DynamicsCompressorNode | null = null;
  midComp: DynamicsCompressorNode | null = null;
  highComp: DynamicsCompressorNode | null = null;
  multibandMerge: GainNode | null = null;

  // Visual Modulation Nodes
  saturationNode: WaveShaperNode | null = null;
  reverbNode: ConvolverNode | null = null;
  reverbMixGain: GainNode | null = null; 
  delayNode: DelayNode | null = null;
  delayFeedback: GainNode | null = null;
  delayMixGain: GainNode | null = null; 
  
  droneGain: GainNode | null = null;
  droneOscs: OscillatorNode[] = [];
  noiseGain: GainNode | null = null;
  noiseSource: AudioBufferSourceNode | null = null;
  
  destNode: MediaStreamAudioDestinationNode | null = null;
  mediaRecorder: MediaRecorder | null = null;
  audioChunks: Blob[] = [];

  // FLUX RIG NODES
  fluxBusIn: GainNode | null = null;
  fluxBusOut: GainNode | null = null;
  tapeStopDelay: DelayNode | null = null;
  tapeStopFilter: BiquadFilterNode | null = null;
  fractureDelay: DelayNode | null = null;
  fractureFeedback: GainNode | null = null;
  fractureGain: GainNode | null = null;
  voltageShaper: WaveShaperNode | null = null;
  voltageGain: GainNode | null = null;
  dimensionLeft: DelayNode | null = null;
  dimensionRight: DelayNode | null = null;
  dimensionGain: GainNode | null = null;
  prismOsc: OscillatorNode | null = null;
  prismGain: GainNode | null = null; 
  prismDry: GainNode | null = null;
  gravityDecimatorGain: GainNode | null = null; 
  gravityFilter: BiquadFilterNode | null = null;

  private noiseBuffer: AudioBuffer | null = null;
  private reverbBuffer: AudioBuffer | null = null;
  private isInitialized = false;
  private activeVoices = 0;
  private readonly MAX_POLYPHONY = 64;
  private waveShaperCurve: Float32Array | null = null;
  
  private masterSpeed: number = 1.0;

  private visualBrightness = 0.5;
  private visualHue = 0; 
  private visualMotion = 0;

  bpm: number = 120;

  init() {
    if (this.isInitialized) return;
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    this.generateNoiseBuffer();
    this.generateReverbImpulse(3.5); 
    this.waveShaperCurve = this.makeDistortionCurve(8); 

    this.destNode = this.ctx.createMediaStreamDestination();

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.85;

    this.preAmpGain = this.ctx.createGain();
    this.preAmpGain.gain.value = 1.0;

    // --- MULTIBAND CROSSOVER ---
    // Low Band: < 250Hz
    this.lowBand = this.ctx.createBiquadFilter();
    this.lowBand.type = 'lowpass';
    this.lowBand.frequency.value = 250;
    this.lowBand.Q.value = 0.7;

    // Mid Band: 250Hz - 4000Hz
    this.midBandHighPass = this.ctx.createBiquadFilter();
    this.midBandHighPass.type = 'highpass';
    this.midBandHighPass.frequency.value = 250;
    this.midBandHighPass.Q.value = 0.7;
    
    this.midBandLowPass = this.ctx.createBiquadFilter();
    this.midBandLowPass.type = 'lowpass';
    this.midBandLowPass.frequency.value = 4000;
    this.midBandLowPass.Q.value = 0.7;

    // High Band: > 4000Hz
    this.highBand = this.ctx.createBiquadFilter();
    this.highBand.type = 'highpass';
    this.highBand.frequency.value = 4000;
    this.highBand.Q.value = 0.7;

    const lowGain = this.ctx.createGain();
    lowGain.gain.value = 1.4; // BOOST BASS

    const midGain = this.ctx.createGain();
    midGain.gain.value = 1.0;

    // Bass Tuning: Slower attack to let transient punch, lower ratio to breathe
    this.lowComp = this.ctx.createDynamicsCompressor();
    this.lowComp.threshold.value = -16; 
    this.lowComp.ratio.value = 3.0; 
    this.lowComp.attack.value = 0.03; 
    this.lowComp.release.value = 0.15;

    this.midComp = this.ctx.createDynamicsCompressor();
    this.midComp.threshold.value = -20; 
    this.midComp.ratio.value = 2.0; 
    this.midComp.attack.value = 0.01;
    
    this.highComp = this.ctx.createDynamicsCompressor();
    this.highComp.threshold.value = -24; 
    this.highComp.ratio.value = 1.5; 
    this.highComp.attack.value = 0.005;

    this.multibandMerge = this.ctx.createGain();
    this.multibandMerge.gain.value = 1.0;

    this.preAmpGain.connect(this.lowBand);
    this.lowBand.connect(lowGain);
    lowGain.connect(this.lowComp);
    this.lowComp.connect(this.multibandMerge);

    this.preAmpGain.connect(this.midBandHighPass);
    this.midBandHighPass.connect(this.midBandLowPass);
    this.midBandLowPass.connect(midGain);
    midGain.connect(this.midComp);
    this.midComp.connect(this.multibandMerge);

    this.preAmpGain.connect(this.highBand);
    this.highBand.connect(this.highComp);
    this.highComp.connect(this.multibandMerge);

    this.saturationNode = this.ctx.createWaveShaper();
    this.saturationNode.curve = this.makeDistortionCurve(0.5); 
    this.saturationNode.oversample = 'none'; 
    
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.95;

    this.masterFilter = this.ctx.createBiquadFilter();
    this.masterFilter.type = 'lowpass';
    this.masterFilter.frequency.value = 22000; 

    this.initFluxRig();
    
    this.multibandMerge.connect(this.saturationNode);
    this.saturationNode.connect(this.masterFilter);
    this.masterFilter.connect(this.fluxBusIn!); 
    this.fluxBusOut!.connect(this.masterGain);
    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
    this.analyser.connect(this.destNode);

    const fxBus = this.ctx.createGain();
    fxBus.connect(this.preAmpGain); 

    this.reverbNode = this.ctx.createConvolver();
    if (this.reverbBuffer) this.reverbNode.buffer = this.reverbBuffer;
    
    this.reverbMixGain = this.ctx.createGain();
    this.reverbMixGain.gain.value = 0.3; 
    this.reverbNode.connect(this.reverbMixGain);
    this.reverbMixGain.connect(fxBus);

    this.delayNode = this.ctx.createDelay();
    this.delayNode.delayTime.value = 0.375;
    this.delayFeedback = this.ctx.createGain();
    this.delayFeedback.gain.value = 0.4;
    
    this.delayMixGain = this.ctx.createGain();
    this.delayMixGain.gain.value = 0.3; 

    const delayFilter = this.ctx.createBiquadFilter();
    delayFilter.type = 'lowpass';
    delayFilter.frequency.value = 2000; 
    const delayHighpass = this.ctx.createBiquadFilter();
    delayHighpass.type = 'highpass';
    delayHighpass.frequency.value = 200; 

    this.delayNode.connect(this.delayFeedback);
    this.delayFeedback.connect(delayFilter);
    delayFilter.connect(delayHighpass);
    delayHighpass.connect(this.delayNode);
    
    this.delayNode.connect(this.delayMixGain);
    this.delayMixGain.connect(fxBus);

    this.initEnvironmentNoise();
    this.droneGain = this.ctx.createGain();
    this.droneGain.gain.value = 0.0;
    this.droneGain.connect(this.reverbNode!);

    this.isInitialized = true;
    this.setBPM(120);
  }

  initFluxRig() {
      if (!this.ctx) return;
      this.fluxBusIn = this.ctx.createGain();
      this.fluxBusOut = this.ctx.createGain();

      this.tapeStopDelay = this.ctx.createDelay(2.0); 
      this.tapeStopDelay.delayTime.value = 0.0;
      this.tapeStopFilter = this.ctx.createBiquadFilter();
      this.tapeStopFilter.type = 'lowpass';
      this.tapeStopFilter.frequency.value = 22000;
      
      this.fractureDelay = this.ctx.createDelay(1.0);
      this.fractureDelay.delayTime.value = 0.1; 
      this.fractureFeedback = this.ctx.createGain();
      this.fractureFeedback.gain.value = 0;
      this.fractureGain = this.ctx.createGain();
      this.fractureGain.gain.value = 0;
      this.fractureDelay.connect(this.fractureFeedback);
      this.fractureFeedback.connect(this.fractureDelay);

      this.voltageShaper = this.ctx.createWaveShaper();
      this.voltageShaper.curve = this.makeDistortionCurve(10);
      this.voltageGain = this.ctx.createGain();
      this.voltageGain.gain.value = 0;

      this.dimensionLeft = this.ctx.createDelay();
      this.dimensionRight = this.ctx.createDelay();
      this.dimensionLeft.delayTime.value = 0.01;
      this.dimensionRight.delayTime.value = 0.02;
      this.dimensionGain = this.ctx.createGain();
      this.dimensionGain.gain.value = 0;

      this.prismOsc = this.ctx.createOscillator();
      this.prismOsc.frequency.value = 100;
      this.prismOsc.start();
      this.prismGain = this.ctx.createGain(); 
      this.prismGain.gain.value = 0;
      this.prismDry = this.ctx.createGain();
      this.prismDry.gain.value = 1;
      
      const prismModAmp = this.ctx.createGain();
      prismModAmp.gain.value = 0;
      this.prismOsc.connect(prismModAmp);

      this.gravityFilter = this.ctx.createBiquadFilter();
      this.gravityFilter.type = 'lowpass';
      this.gravityFilter.frequency.value = 22000;
      
      this.gravityDecimatorGain = this.ctx.createGain();
      this.gravityDecimatorGain.gain.value = 1.0;
      
      this.fluxBusIn.connect(this.tapeStopDelay);
      this.tapeStopDelay.connect(this.tapeStopFilter);
      this.tapeStopFilter.connect(this.gravityFilter);
      this.gravityFilter.connect(this.gravityDecimatorGain);

      const chainOut = this.gravityDecimatorGain;

      chainOut.connect(this.fractureDelay);
      this.fractureDelay.connect(this.fractureGain);
      this.fractureGain.connect(this.fluxBusOut);
      
      chainOut.connect(this.voltageShaper);
      this.voltageShaper.connect(this.voltageGain);
      this.voltageGain.connect(this.fluxBusOut);

      chainOut.connect(this.dimensionLeft);
      this.dimensionLeft.connect(this.dimensionGain);
      chainOut.connect(this.dimensionRight);
      this.dimensionRight.connect(this.dimensionGain);
      this.dimensionGain.connect(this.fluxBusOut);

      chainOut.connect(this.prismDry);
      this.prismDry.connect(this.fluxBusOut);
      chainOut.connect(prismModAmp); 
      prismModAmp.connect(this.prismGain);
      this.prismGain.connect(this.fluxBusOut);
      
      chainOut.connect(this.fluxBusOut);
  }

  setFluxParams(params: { tapeVal: number, fracture: boolean, voltage: boolean, dimension: boolean, prismVal: number, gravityX?: number, gravityY?: number }) {
      if (!this.ctx || !this.fluxBusIn) return;
      const t = this.ctx.currentTime;
      
      let speed = 1.0;
      if (params.tapeVal <= 0.5) {
          speed = 2.0 - (params.tapeVal * 2); 
      } else {
          speed = 1.0 - ((params.tapeVal - 0.5) * 2);
      }
      this.masterSpeed = Math.max(0.01, speed); 

      let filterF = 22000;
      if (params.tapeVal > 0.5) {
          filterF = 22000 * Math.pow(0.01, (params.tapeVal - 0.5) * 2);
      }
      this.tapeStopFilter?.frequency.setTargetAtTime(Math.max(20, filterF), t, 0.1);
      
      const delayT = params.tapeVal > 0.5 ? (params.tapeVal - 0.5) * 0.2 : 0;
      this.tapeStopDelay?.delayTime.setTargetAtTime(delayT, t, 0.3);

      if (params.gravityX !== undefined && params.gravityY !== undefined && this.gravityFilter) {
          const open = 1 - params.gravityY;
          const freq = 50 * Math.pow(2, open * 10); 
          this.gravityFilter.frequency.setTargetAtTime(Math.min(22000, freq), t, 0.1);
          this.gravityFilter.Q.value = 2 + (params.gravityX * 5); 
      }

      this.fractureGain?.gain.setTargetAtTime(params.fracture ? 1 : 0, t, 0.05);
      this.fractureFeedback?.gain.setTargetAtTime(params.fracture ? 0.9 : 0, t, 0.05);
      this.voltageGain?.gain.setTargetAtTime(params.voltage ? 0.8 : 0, t, 0.05);
      this.dimensionGain?.gain.setTargetAtTime(params.dimension ? 1 : 0, t, 0.05);

      const ringFreq = 100 + (params.prismVal * 2000);
      this.prismOsc?.frequency.setTargetAtTime(ringFreq, t, 0.1);
      const isPrismActive = params.prismVal > 0.05;
      this.prismGain?.gain.setTargetAtTime(isPrismActive ? 1 : 0, t, 0.05);
      this.prismDry?.gain.setTargetAtTime(isPrismActive ? 0 : 1, t, 0.05);
  }

  updateVisualModulation(motion: number, brightness: number, hue: number) {
      if (!this.ctx || !this.reverbMixGain || !this.delayMixGain || !this.delayFeedback) return;
      
      this.visualMotion = motion; 
      this.visualBrightness = brightness; 
      this.visualHue = hue; 

      const now = this.ctx.currentTime;
      const targetReverb = 0.1 + (brightness * 0.7);
      this.reverbMixGain.gain.setTargetAtTime(targetReverb, now, 0.5);
      const targetFeedback = 0.2 + (brightness * 0.5);
      this.delayFeedback.gain.setTargetAtTime(targetFeedback, now, 0.5);
  }

  private generateNoiseBuffer() {
      if (!this.ctx) return;
      const bufferSize = this.ctx.sampleRate * 2.0;
      this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      let lastOut = 0;
      for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          data[i] = (lastOut + (0.02 * white)) / 1.02;
          lastOut = data[i];
          data[i] *= 0.5; 
      }
  }

  private generateReverbImpulse(duration: number) {
    if (!this.ctx) return;
    const rate = this.ctx.sampleRate;
    const length = rate * duration;
    this.reverbBuffer = this.ctx.createBuffer(2, length, rate);
    const left = this.reverbBuffer.getChannelData(0);
    const right = this.reverbBuffer.getChannelData(1);
    for (let i = 0; i < length; i++) {
        const decay = Math.pow(1 - i / length, 4.0); 
        left[i] = (Math.random() * 2 - 1) * decay;
        right[i] = (Math.random() * 2 - 1) * decay;
    }
  }

  private initEnvironmentNoise() {
      if (!this.ctx || !this.preAmpGain) return;
      try {
          const bufferSize = this.ctx.sampleRate * 2;
          const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
          const data = buffer.getChannelData(0);
          for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
          this.noiseSource = this.ctx.createBufferSource();
          this.noiseSource.buffer = buffer;
          this.noiseSource.loop = true;
          this.noiseGain = this.ctx.createGain();
          this.noiseGain.gain.value = 0.0; 
          const noiseFilter = this.ctx.createBiquadFilter();
          noiseFilter.type = 'bandpass';
          noiseFilter.frequency.value = 800;
          noiseFilter.Q.value = 0.5;
          this.noiseSource.connect(noiseFilter);
          noiseFilter.connect(this.noiseGain);
          this.noiseGain.connect(this.preAmpGain!);
          this.noiseSource.start(0);
      } catch (e) {}
  }

  updateEnvironment(droneVol: number, noiseVol: number, rootKey: RootKey, scale: MusicalScale) {
      if (!this.ctx || !this.droneGain || !this.noiseGain) return;
      const now = this.ctx.currentTime;
      this.droneGain.gain.setTargetAtTime(droneVol * 0.15, now, 0.5);
      this.noiseGain.gain.setTargetAtTime(noiseVol * 0.05, now, 0.5);
      if (droneVol > 0 && this.droneOscs.length === 0) this.startDrone(rootKey, scale);
      else if (droneVol === 0 && this.droneOscs.length > 0) this.stopDrone();
  }

  private startDrone(root: RootKey, scale: MusicalScale) {
      if (!this.ctx || !this.droneGain) return;
      this.stopDrone();
      const freqs = [
          getFrequencyFromScale(root, scale, 2, 0),
          getFrequencyFromScale(root, scale, 3, 0),
          getFrequencyFromScale(root, scale, 2, 4),
      ];
      freqs.forEach((f, i) => {
          const osc = this.ctx!.createOscillator();
          osc.type = i === 2 ? 'sine' : 'triangle';
          osc.frequency.value = f * this.masterSpeed; 
          const lfo = this.ctx!.createOscillator();
          lfo.frequency.value = 0.1 + Math.random() * 0.2;
          const lfoGain = this.ctx!.createGain();
          lfoGain.gain.value = 2;
          lfo.connect(lfoGain);
          lfoGain.connect(osc.frequency);
          lfo.start();
          osc.connect(this.droneGain!);
          osc.start();
          this.droneOscs.push(osc);
      });
  }

  private stopDrone() {
      this.droneOscs.forEach(o => { try { o.stop(); o.disconnect(); } catch(e){} });
      this.droneOscs = [];
  }

  startRecording() {
    if (!this.destNode) return;
    this.audioChunks = [];
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
    this.mediaRecorder = new MediaRecorder(this.destNode.stream, { mimeType });
    this.mediaRecorder.ondataavailable = (event) => { if (event.data.size > 0) this.audioChunks.push(event.data); };
    this.mediaRecorder.start();
  }

  stopRecording(): Promise<Blob> {
      return new Promise((resolve, reject) => {
          if (!this.mediaRecorder) return reject("No recorder");
          this.mediaRecorder.onstop = () => {
              const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
              resolve(audioBlob);
          };
          this.mediaRecorder.stop();
      });
  }

  setBPM(bpm: number) {
      this.bpm = bpm;
      if (this.ctx && this.delayNode) {
          const beatTime = 60 / bpm;
          this.delayNode.delayTime.setTargetAtTime(beatTime * 0.75, this.ctx.currentTime, 0.2);
      }
  }

  makeDistortionCurve(amount: number) {
    const k = amount;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = (Math.atan(k * x) / Math.atan(k)); 
    }
    return curve;
  }

  resume() { if (this.ctx?.state === 'suspended') this.ctx.resume(); }
  
  async decodeAudioData(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
      if (!this.ctx) this.init();
      return await this.ctx!.decodeAudioData(arrayBuffer);
  }
  
  setGlobalFilter(value: number) {
     if (!this.masterFilter || !this.ctx) return;
     const minFreq = Math.log(40); const maxFreq = Math.log(20000);
     const freq = Math.exp(minFreq + (value) * (maxFreq - minFreq));
     this.masterFilter.frequency.setTargetAtTime(Math.max(20, Math.min(22000, freq)), this.ctx.currentTime, 0.1);
  }
  
  setGlobalDelayFeedback(value: number) {}

  triggerDrum(type: DrumType, velocity: number = 1, pan: number = 0) {
      if (!this.ctx || !this.preAmpGain) return;
      if (this.activeVoices >= this.MAX_POLYPHONY) return;
      this.activeVoices++;
      const t = this.ctx.currentTime;
      const gain = this.ctx.createGain();
      const panner = this.ctx.createStereoPanner();
      panner.pan.value = pan;
      gain.connect(panner); 
      
      panner.connect(this.preAmpGain);
      
      const decayMod = 1.0 - (this.visualMotion * 0.5);

      // DYNAMIC HEADROOM SCALING
      // Reduce gain as more voices become active to prevent clipping
      const polyScale = 1 / Math.sqrt(Math.max(1, this.activeVoices));
      const masterScale = 0.35 * polyScale; // Reduced from 0.4

      if (type === '808' || type === '909') {
          const osc = this.ctx.createOscillator();
          osc.type = 'sine';
          const baseFreq = (type === '808' ? 140 : 180) * this.masterSpeed;
          const endFreq = (type === '808' ? 35 : 45) * this.masterSpeed;
          osc.frequency.setValueAtTime(baseFreq, t);
          osc.frequency.exponentialRampToValueAtTime(endFreq, t + 0.1);
          
          // Boost drum volume slightly
          gain.gain.setValueAtTime(1.2 * velocity * masterScale, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + (type === '808' ? 0.6 : 0.3) * decayMod);
          osc.connect(gain);
          osc.start(t); osc.stop(t + 0.6);
          osc.onended = () => { osc.disconnect(); gain.disconnect(); panner.disconnect(); this.activeVoices--; };
      } else {
          const bufferSize = this.ctx.sampleRate * 0.05;
          const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
          const data = buffer.getChannelData(0);
          for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
          const noise = this.ctx.createBufferSource();
          noise.buffer = buffer;
          noise.playbackRate.value = this.masterSpeed; 
          const filter = this.ctx.createBiquadFilter();
          filter.type = 'highpass'; filter.frequency.value = 6000;
          gain.gain.setValueAtTime(0.5 * velocity * masterScale, t); 
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
          noise.connect(filter); filter.connect(gain);
          noise.start(t); noise.stop(t + 0.05);
          noise.onended = () => { noise.disconnect(); filter.disconnect(); gain.disconnect(); panner.disconnect(); this.activeVoices--; };
      }
  }

  trigger(config: InstrumentConfig, frequency: number, velocity: number = 1, spatialPos: Vector2 = {x: 0, y: 0}) {
    if (!this.ctx || !this.preAmpGain) return;
    if (this.activeVoices >= this.MAX_POLYPHONY) return;
    
    let modFreq = frequency * this.masterSpeed; 
    const hue = this.visualHue;
    
    if (hue > 160 && hue < 260 && Math.random() > 0.7) modFreq *= 1.5; 
    else if ((hue > 280 || hue < 20) && Math.random() > 0.8) modFreq *= 2.0; 
    else if (hue > 20 && hue < 60 && Math.random() > 0.8) modFreq *= 0.5;

    if (config.sourceType === 'granular' && config.sampleBuffer) this.triggerGranular(config, modFreq, velocity, spatialPos);
    else if (config.sourceType === 'physical') this.triggerPhysical(config, modFreq, velocity, spatialPos);
    else if (config.sourceType === 'sampler' && config.sampleBuffer) this.triggerSample(config, modFreq, velocity, spatialPos);
    else this.triggerSynth(config, modFreq, velocity, spatialPos);
  }

  triggerPhysical(config: InstrumentConfig, frequency: number, velocity: number, spatialPos: Vector2) { return; }

  triggerGranular(config: InstrumentConfig, frequency: number, velocity: number, spatialPos: Vector2) {
      if (!this.ctx || !config.sampleBuffer || !this.preAmpGain) return;
      this.activeVoices++;
      const t = this.ctx.currentTime;
      const grainCount = 4;
      const grainSize = (0.05 + (config.grainSize || 0.1)) * (velocity * 2); 
      const bufferDuration = config.sampleBuffer.duration;
      const position = ((spatialPos.x + 1) / 2) * bufferDuration;
      const colorMod = config.color ?? 0.5;
      
      const polyScale = 1 / Math.sqrt(Math.max(1, this.activeVoices));
      const masterScale = 0.35 * polyScale;

      for(let i=0; i<grainCount; i++) {
          const source = this.ctx.createBufferSource();
          source.buffer = config.sampleBuffer;
          const jitter = (Math.random() - 0.5) * (config.grainJitter || 0.1);
          const start = Math.max(0, Math.min(bufferDuration - grainSize, position + jitter));
          const grainRate = (frequency / 261.63) * (0.9 + Math.random() * 0.2 * colorMod) * this.masterSpeed;
          source.playbackRate.value = grainRate; 
          const gain = this.ctx.createGain();
          const panner = this.ctx.createStereoPanner();
          panner.pan.value = Math.max(-1, Math.min(1, spatialPos.x + (Math.random()-0.5)*0.5));
          gain.gain.setValueAtTime(0, t);
          
          gain.gain.linearRampToValueAtTime(config.vol * velocity * masterScale, t + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.001, t + grainSize);
          const driveNode = this.ctx.createGain();
          driveNode.gain.value = 1.0 + (config.drive || 0) * 2;
          source.connect(driveNode); driveNode.connect(gain); gain.connect(panner); 
          
          panner.connect(this.preAmpGain!); 
          
          const timeOffset = i * 0.03;
          source.start(t + timeOffset, start, grainSize);
          source.stop(t + timeOffset + grainSize + 0.1);
          source.onended = () => { source.disconnect(); gain.disconnect(); panner.disconnect(); driveNode.disconnect(); if(i===grainCount-1) this.activeVoices--; };
      }
      this.connectFX(this.preAmpGain!, 0.4, 0.4);
  }

  triggerSample(config: InstrumentConfig, frequency: number, velocity: number, spatialPos: Vector2) {
     if (!this.ctx || !config.sampleBuffer || !this.preAmpGain) return;
     this.activeVoices++;
     const t = this.ctx.currentTime;
     const source = this.ctx.createBufferSource();
     source.buffer = config.sampleBuffer;
     const colorPitchMod = (config.color ?? 0.5) * 2 - 1; 
     source.playbackRate.value = (frequency / 261.63) * (1 + colorPitchMod * 0.5) * this.masterSpeed;
     
     const duration = config.sampleBuffer.duration / source.playbackRate.value;

     if (this.visualMotion > 0.5 && Math.random() > 0.5) {
         source.loop = true;
         source.loopStart = Math.random() * config.sampleBuffer.duration * 0.5;
         source.loopEnd = source.loopStart + 0.05 + (Math.random() * 0.1);
     }
     const gain = this.ctx.createGain();
     const panner = this.ctx.createStereoPanner();
     panner.pan.value = config.spatialMod ? Math.max(-1, Math.min(1, spatialPos.x)) : config.pan;
     const release = config.release * (0.5 + (config.time??0.5));
     
     const polyScale = 1 / Math.sqrt(Math.max(1, this.activeVoices));
     const masterScale = 0.35 * polyScale;
     
     const targetVol = config.vol * velocity * masterScale;
     gain.gain.setValueAtTime(0, t);
     gain.gain.linearRampToValueAtTime(targetVol, t + 0.005);
     gain.gain.exponentialRampToValueAtTime(0.001, t + duration + release + 0.5);
     
     // WaveShaper for Sampler Distortion
     if (config.drive && config.drive > 0) {
         const shaper = this.ctx.createWaveShaper();
         if (this.waveShaperCurve) shaper.curve = this.waveShaperCurve;
         shaper.oversample = 'none';
         
         const driveGain = this.ctx.createGain();
         driveGain.gain.value = 1.0 + (config.drive * 3.0);
         
         const compGain = this.ctx.createGain();
         compGain.gain.value = 1.0 / (1.0 + config.drive * 2.0);
         
         source.connect(driveGain);
         driveGain.connect(shaper);
         shaper.connect(compGain);
         compGain.connect(gain);
     } else {
         source.connect(gain);
     }
     
     gain.connect(panner); 
     panner.connect(this.preAmpGain!);

     this.connectFX(gain, 0.15 + (config.time??0.5)*0.2, 0.15 + (config.time??0.5)*0.2);
     
     source.start(t); 
     source.stop(t + duration + release + 0.5);
     source.onended = () => { source.disconnect(); gain.disconnect(); panner.disconnect(); this.activeVoices--; };
  }

  triggerSynth(config: InstrumentConfig, frequency: number, velocity: number, spatialPos: Vector2) {
    if (!this.ctx || !this.preAmpGain) return;
    this.activeVoices++;
    const t = this.ctx.currentTime;
    const motionTimbreMod = this.visualMotion * 0.5;
    const timbre = Math.min(1.0, (config.timbre ?? 0.5) + motionTimbreMod);
    const drive = config.drive || 0;
    const color = config.color ?? 0.5;
    const oscMain = this.ctx.createOscillator(); 
    oscMain.type = config.waveform; 
    oscMain.frequency.setValueAtTime(frequency, t);
    
    let fmOsc: OscillatorNode | null = null;
    let fmGain: GainNode | null = null;
    if (this.visualMotion > 0.3 || timbre > 0.1) { 
        fmOsc = this.ctx.createOscillator();
        fmOsc.frequency.value = frequency * (2 + timbre); 
        fmGain = this.ctx.createGain();
        fmGain.gain.value = frequency * (this.visualMotion + timbre) * 2; 
        fmOsc.connect(fmGain);
        fmGain.connect(oscMain.frequency);
        fmOsc.start(t);
    }
    const oscSub = this.ctx.createOscillator(); 
    oscSub.type = config.waveform === 'sine' ? 'sine' : 'square'; 
    oscSub.frequency.setValueAtTime(frequency/2, t);
    const gain = this.ctx.createGain();
    const panner = this.ctx.createStereoPanner();
    panner.pan.value = config.spatialMod ? Math.max(-1, Math.min(1, spatialPos.x)) : config.pan;
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = config.filterType || 'lowpass';
    
    let targetFreq;
    const baseFilterFreq = config.filterFreq || 1000;

    // SAFE FILTER LOGIC
    if (filter.type === 'lowpass') {
        const minF = Math.log(100);
        const maxF = Math.log(15000);
        targetFreq = Math.exp(minF + (color) * (maxF - minF));
        // Ensure filter never closes below fundamental
        targetFreq = Math.max(targetFreq, frequency * 0.5);
    } else if (filter.type === 'highpass') {
        // Clamp Highpass to 1000Hz Max to prevent silencing signal
        const minF = Math.log(50);
        const maxF = Math.log(1000); 
        targetFreq = Math.exp(minF + (color) * (maxF - minF));
    } else {
        const ratio = Math.pow(4, (color - 0.5) * 2); 
        targetFreq = baseFilterFreq * ratio;
        targetFreq = Math.max(100, Math.min(10000, targetFreq));
    }

    filter.frequency.setValueAtTime(targetFreq, t);
    if (config.filterType === 'lowpass' || config.filterType === 'bandpass') {
        filter.frequency.linearRampToValueAtTime(targetFreq * (1 + velocity * 0.5), t + 0.1);
    }
    filter.Q.value = (config.filterQ||1) + (color * 5);
    
    // FIXED ROUTING: Oscillators always connect to filter first
    oscMain.connect(filter); 
    oscSub.connect(filter); 

    if (drive > 0) {
        const shaper = this.ctx.createWaveShaper();
        if (this.waveShaperCurve) shaper.curve = this.waveShaperCurve;
        shaper.oversample = 'none'; 
        
        const preGain = this.ctx.createGain();
        preGain.gain.value = 1.0 + (drive * 5.0);
        
        const postGain = this.ctx.createGain();
        postGain.gain.value = 1.0 / (1.0 + drive * 3.0); 
        
        filter.connect(preGain);
        preGain.connect(shaper);
        shaper.connect(postGain);
        postGain.connect(gain);
    } else {
        filter.connect(gain);
    }
    
    gain.connect(panner); 
    panner.connect(this.preAmpGain!);

    const stopTime = t + config.attack + config.decay + config.release * (0.8 + (config.time??0.5)*1.5);
    gain.gain.setValueAtTime(0, t);
    
    const polyScale = 1 / Math.sqrt(Math.max(1, this.activeVoices));
    const masterScale = 0.35 * polyScale; // Reduced from 0.4

    gain.gain.linearRampToValueAtTime(config.vol * velocity * masterScale, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, stopTime);
    
    this.connectFX(gain, 0.2 * (0.5+(config.time??0.5)), 0.3 * (0.5+(config.time??0.5)));
    
    oscMain.start(t); 
    oscSub.start(t); 
    oscMain.stop(stopTime+0.1); 
    oscSub.stop(stopTime+0.1);
    if (fmOsc) fmOsc.stop(stopTime+0.1);
    
    oscMain.onended = () => { 
        oscMain.disconnect(); oscSub.disconnect(); filter.disconnect(); 
        gain.disconnect(); panner.disconnect(); 
        if (fmOsc) { fmOsc.disconnect(); fmGain?.disconnect(); }
        this.activeVoices--; 
    };
  }

  connectFX(source: AudioNode, reverbAmt: number, delayAmt: number) {
      if (!this.ctx || !this.reverbNode || !this.delayNode) return;
      const r = this.ctx.createGain(); r.gain.value = reverbAmt; 
      source.connect(r); r.connect(this.reverbNode);
      const d = this.ctx.createGain(); d.gain.value = delayAmt; 
      source.connect(d); d.connect(this.delayNode);
  }
}

export const audio = new AudioEngine();
