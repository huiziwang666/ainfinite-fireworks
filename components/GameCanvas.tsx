import React, { useEffect, useRef, useCallback } from 'react';
import { HandState, Point } from '../types';
import { AudioEngine } from '../services/audioService';

// --- Configuration & Helpers ---

// Colorful firework palettes (HSL hues)
const COLOR_PALETTES = [
  { hue: 0, name: 'red' },        // Bright red
  { hue: 15, name: 'scarlet' },   // Scarlet
  { hue: 30, name: 'orange' },    // Orange
  { hue: 45, name: 'gold' },      // Gold
  { hue: 55, name: 'yellow' },    // Yellow
  { hue: 120, name: 'green' },    // Green
  { hue: 160, name: 'cyan' },     // Cyan
  { hue: 200, name: 'blue' },     // Blue
  { hue: 240, name: 'indigo' },   // Indigo
  { hue: 280, name: 'purple' },   // Purple
  { hue: 300, name: 'magenta' },  // Magenta
  { hue: 330, name: 'pink' },     // Pink
];

// Explosion styles
const EXPLOSION_STYLES = ['circle', 'ring', 'burst', 'willow', 'chrysanthemum'] as const;
type ExplosionStyle = typeof EXPLOSION_STYLES[number];

const randomChoice = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
const randomRange = (min: number, max: number) => Math.random() * (max - min) + min;

// HSL color helper
const hsl = (h: number, s: number, l: number, a: number = 1) => {
  return `hsla(${h % 360}, ${Math.min(100, Math.max(0, s))}%, ${Math.min(100, Math.max(0, l))}%, ${a})`;
};

const MAX_PARTICLES = 2000;

// --- Particle Class (from Gemini example, adapted) ---

class Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hue: number;
  lightness: number;
  alpha: number;
  decay: number;
  friction: number;
  gravity: number;
  size: number;

  constructor(x: number, y: number, hue: number, velocity: { x: number; y: number }, lightness: number = 55, size: number = 2) {
    this.x = x;
    this.y = y;
    this.vx = velocity.x;
    this.vy = velocity.y;
    this.hue = hue;
    this.lightness = lightness + Math.random() * 10; // Less variation, keeps colors vibrant
    this.alpha = 1;
    this.decay = 0.012 + Math.random() * 0.018;
    this.friction = 0.98;
    this.gravity = 0.04;
    this.size = size + Math.random() * 2;
  }

  update() {
    this.vx *= this.friction;
    this.vy *= this.friction;
    this.vy += this.gravity;
    this.x += this.vx;
    this.y += this.vy;
    this.alpha -= this.decay;
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.alpha <= 0) return;
    ctx.beginPath();
    ctx.fillStyle = hsl(this.hue, 100, this.lightness, this.alpha);
    ctx.arc(this.x, this.y, this.size * this.alpha, 0, Math.PI * 2);
    ctx.fill();
  }

  isDead() {
    return this.alpha <= 0;
  }
}

// --- Component ---

const HORSE_TEXT_LINE1 = "The Year of Horse 2026";
const HORSE_TEXT_LINE2 = "Westcot Elementary School Lunar New Year Celebration";

interface GameCanvasProps {
  onHandsDetected: (detected: boolean) => void;
}

const GameCanvas: React.FC<GameCanvasProps> = ({ onHandsDetected }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<AudioEngine | null>(null);
  const bgMusicRef = useRef<HTMLAudioElement | null>(null);
  const bgImageRef = useRef<HTMLImageElement | null>(null);
  const logoRef = useRef<HTMLImageElement | null>(null);

  // Game State
  const particles = useRef<Particle[]>([]);
  
  // Track debounce and hand state
  const handStateRef = useRef<{ [key: string]: HandState }>({ 'Left': HandState.UNKNOWN, 'Right': HandState.UNKNOWN });
  const prevHandStateRef = useRef<{ [key: string]: HandState }>({ 'Left': HandState.UNKNOWN, 'Right': HandState.UNKNOWN });
  const handPosRef = useRef<{ [key: string]: Point }>({ 'Left': {x:0,y:0}, 'Right': {x:0,y:0} });
  const lastTriggerTime = useRef<{ [key: string]: number }>({ 'Left': 0, 'Right': 0 });
  const grandFinaleRef = useRef<{ active: boolean; lastSpawn: number }>({ active: false, lastSpawn: 0 });

  useEffect(() => {
    audioRef.current = new AudioEngine();

    // Load background image
    const bgImage = new Image();
    bgImage.src = '/night.jpg';
    bgImageRef.current = bgImage;

    // Load logo image
    const logo = new Image();
    logo.src = '/new-logo.png';
    logoRef.current = logo;

    // Start background music
    const bgMusic = new Audio('/background.mp3');
    bgMusic.loop = true;
    bgMusic.volume = 0.5;
    bgMusic.play().catch(e => console.log('Audio autoplay blocked:', e));
    bgMusicRef.current = bgMusic;

    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }

    const onResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };
    window.addEventListener('resize', onResize);

    const initMediaPipe = async () => {
      const { Hands, Camera } = window as any;
      
      const hands = new Hands({
        locateFile: (file: string) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        }
      });

      hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      hands.onResults(onResults);

      if (videoRef.current) {
        const camera = new Camera(videoRef.current, {
          onFrame: async () => {
            if (videoRef.current) {
              await hands.send({ image: videoRef.current });
            }
          },
          width: 640,
          height: 480
        });
        camera.start();
      }
    };

    initMediaPipe();

    const render = () => {
      draw();
      requestAnimationFrame(render);
    };
    render();

    return () => {
      window.removeEventListener('resize', onResize);
      if (bgMusicRef.current) {
        bgMusicRef.current.pause();
        bgMusicRef.current = null;
      }
    };
  }, []);

  const onResults = useCallback((results: any) => {
    if (results.multiHandLandmarks && results.multiHandedness) {
      onHandsDetected(results.multiHandLandmarks.length > 0);
      const foundHands = new Set<string>();

      for (let i = 0; i < results.multiHandLandmarks.length; i++) {
        const landmarks = results.multiHandLandmarks[i];
        const label = results.multiHandedness[i].label;
        foundHands.add(label);
        
        const wrist = landmarks[0];
        const tips = [8, 12, 16, 20];
        let avgDist = 0;
        
        tips.forEach(tipIdx => {
            const dx = landmarks[tipIdx].x - wrist.x;
            const dy = landmarks[tipIdx].y - wrist.y;
            avgDist += Math.sqrt(dx*dx + dy*dy);
        });
        avgDist /= 4;

        // Detection Logic: < 0.25 is fist, > 0.25 is open
        const newState = avgDist < 0.25 ? HandState.FIST : HandState.OPEN;
        
        handPosRef.current[label] = { x: wrist.x, y: wrist.y };
        handStateRef.current[label] = newState;
      }

      // Clear missing hands
      ['Left', 'Right'].forEach(hand => {
        if (!foundHands.has(hand)) {
          handStateRef.current[hand] = HandState.UNKNOWN;
        }
      });
    }
  }, [onHandsDetected]);

  const triggerFirework = (x: number, y: number) => {
    if (!canvasRef.current) return;
    if (particles.current.length > MAX_PARTICLES) return;

    audioRef.current?.playExplosion(1);

    // Random palette and style
    const palette = randomChoice(COLOR_PALETTES);
    const style = randomChoice(EXPLOSION_STYLES);

    // Vary size: small (60-80), medium (100-140), large (160-220)
    const sizeClass = Math.random();
    let particleCount: number;
    let explosionPower: number;
    let baseSize: number;

    if (sizeClass < 0.3) {
      // Small firework
      particleCount = randomRange(70, 110);
      explosionPower = randomRange(5, 8);
      baseSize = randomRange(3.5, 5);
    } else if (sizeClass < 0.7) {
      // Medium firework
      particleCount = randomRange(120, 180);
      explosionPower = randomRange(8, 11);
      baseSize = randomRange(4.5, 6);
    } else {
      // Large firework
      particleCount = randomRange(200, 300);
      explosionPower = randomRange(10, 14);
      baseSize = randomRange(5.5, 7.5);
    }

    // Create particles based on style
    for (let i = 0; i < particleCount; i++) {
      let angle = Math.random() * Math.PI * 2;
      let velocity = Math.random() * explosionPower;
      let hueVariation = palette.hue + (Math.random() - 0.5) * 30;
      let lightness = randomRange(45, 55); // Highly saturated colors
      let size = baseSize;
      let decay = randomRange(0.01, 0.02);
      let gravity = 0.04;

      // Style-specific adjustments
      switch (style) {
        case 'ring':
          // Particles all at same speed = ring shape
          velocity = explosionPower * (0.85 + Math.random() * 0.3);
          decay = randomRange(0.015, 0.025);
          lightness = randomRange(45, 55);
          break;
        case 'burst':
          // Some particles go much faster, bright colors
          if (Math.random() > 0.7) velocity *= 1.8;
          lightness = randomRange(45, 58);
          break;
        case 'willow':
          // Slow, droopy particles with color variation
          velocity = explosionPower * randomRange(0.3, 0.7);
          gravity = 0.08;
          decay = randomRange(0.008, 0.015);
          // Add some complementary color sparks
          if (Math.random() > 0.7) hueVariation = (palette.hue + 180) % 360;
          lightness = randomRange(45, 55);
          break;
        case 'chrysanthemum':
          // Dense with bright colored tips
          if (Math.random() > 0.7) {
            // Brighter version of same color instead of white
            lightness = randomRange(50, 60);
          }
          velocity = explosionPower * randomRange(0.5, 1.0);
          break;
        case 'circle':
        default:
          // Standard random spread
          break;
      }

      const particle = new Particle(x, y, hueVariation, {
        x: Math.cos(angle) * velocity,
        y: Math.sin(angle) * velocity
      }, lightness, size);
      particle.decay = decay;
      particle.gravity = gravity;
      particles.current.push(particle);
    }
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // 1. Trail fade effect
    ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
    ctx.fillRect(0, 0, width, height);

    // 2. Draw background image (with low opacity to show through trails)
    // Crop out more of the ocean by extending image below canvas
    ctx.globalCompositeOperation = 'source-over';
    if (bgImageRef.current && bgImageRef.current.complete) {
      ctx.globalAlpha = 0.15;
      const imageHeight = height * 1.35; // Extend 35% below canvas to crop ocean
      ctx.drawImage(bgImageRef.current, 0, 0, width, imageHeight);
      ctx.globalAlpha = 1;
    }

    // Responsive scaling factor based on screen size
    const scale = Math.min(width / 1920, height / 1080);
    const minScale = Math.max(0.5, scale);

    // 3. Logo and branding - top left
    if (logoRef.current && logoRef.current.complete) {
      ctx.save();
      const logoSize = Math.max(50, 80 * minScale);
      const logoMargin = Math.max(20, 30 * minScale);
      ctx.drawImage(logoRef.current, logoMargin, logoMargin, logoSize, logoSize);
      ctx.font = `bold ${Math.max(28, Math.floor(48 * minScale))}px "Cinzel", serif`;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#FFD700';
      ctx.shadowColor = '#FF2200';
      ctx.shadowBlur = 12 * minScale;
      ctx.fillText('AInfinite', logoMargin + logoSize + 15, logoMargin + logoSize * 0.7);
      ctx.restore();
    }

    // 4. Text - Chinese New Year styling - bottom right
    ctx.save();
    ctx.textAlign = 'right';
    ctx.fillStyle = '#FFD700';
    ctx.shadowColor = '#FF2200';
    ctx.shadowBlur = 12 * minScale;
    const margin = Math.max(10, 20 * minScale);

    // Responsive font sizes - smaller on mobile for line 2 only
    const isMobile = width < 768;
    const line1FontSize = Math.max(20, Math.floor(36 * minScale));
    const line2FontSize = isMobile ? Math.max(12, Math.floor(14 * minScale)) : Math.max(14, Math.floor(26 * minScale));
    const lineSpacing = isMobile ? Math.max(18, 22 * minScale) : Math.max(25, 35 * minScale);

    ctx.font = `bold ${line1FontSize}px "Cinzel", serif`;
    ctx.fillText(HORSE_TEXT_LINE1, width - margin, height - margin - lineSpacing);
    ctx.font = `bold ${line2FontSize}px "Cinzel", serif`;
    ctx.fillText(HORSE_TEXT_LINE2, width - margin, height - margin);
    ctx.restore();

    // 4. Switch to lighter blend for particles
    ctx.globalCompositeOperation = 'lighter';

    // 5. Input Logic (Hand gesture detection)
    const now = Date.now();
    const leftState = handStateRef.current['Left'];
    const rightState = handStateRef.current['Right'];

    // Check for Grand Finale mode (both hands open)
    const bothHandsOpen = leftState === HandState.OPEN && rightState === HandState.OPEN;
    grandFinaleRef.current.active = bothHandsOpen;

    // Grand Finale: SPECTACULAR fireworks show
    if (bothHandsOpen && now - grandFinaleRef.current.lastSpawn > 15) {
      const phase = Math.floor(now / 400) % 6; // Faster cycle through more patterns

      // Pattern 1: Symmetrical bursts from sides
      if (phase === 0) {
        const y = Math.random() * height * 0.5 + height * 0.15;
        triggerFirework(width * 0.1, y);
        triggerFirework(width * 0.9, y);
        triggerFirework(width * 0.3, y - 30);
        triggerFirework(width * 0.7, y - 30);
        triggerFirework(width * 0.5, y - 60);
      }
      // Pattern 2: Rising wave
      else if (phase === 1) {
        for (let i = 0; i < 6; i++) {
          const x = (Math.random() * 0.8 + 0.1) * width;
          const y = Math.random() * height * 0.5 + height * 0.1;
          triggerFirework(x, y);
        }
      }
      // Pattern 3: Center explosion cascade
      else if (phase === 2) {
        const centerX = width / 2 + (Math.random() - 0.5) * 200;
        const centerY = height * 0.3 + (Math.random() - 0.5) * 100;
        triggerFirework(centerX, centerY);
        triggerFirework(centerX - 150, centerY + 80);
        triggerFirework(centerX + 150, centerY + 80);
        triggerFirework(centerX - 100, centerY - 50);
        triggerFirework(centerX + 100, centerY - 50);
      }
      // Pattern 4: Diagonal cross
      else if (phase === 3) {
        triggerFirework(width * 0.15, height * 0.15);
        triggerFirework(width * 0.85, height * 0.15);
        triggerFirework(width * 0.5, height * 0.35);
        triggerFirework(width * 0.15, height * 0.55);
        triggerFirework(width * 0.85, height * 0.55);
        triggerFirework(width * 0.3, height * 0.25);
        triggerFirework(width * 0.7, height * 0.25);
      }
      // Pattern 5: Circle burst
      else if (phase === 4) {
        const cx = width / 2;
        const cy = height * 0.4;
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2;
          const radius = 200;
          triggerFirework(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius * 0.6);
        }
      }
      // Pattern 6: Random chaos explosion
      else {
        for (let i = 0; i < 8; i++) {
          const randX = Math.random() * width;
          const randY = Math.random() * height * 0.7 + height * 0.1;
          triggerFirework(randX, randY);
        }
      }
      grandFinaleRef.current.lastSpawn = now;
    }

    // Draw spectacular "GRAND FINALE" text when active
    if (bothHandsOpen) {
      ctx.globalCompositeOperation = 'source-over';

      // Pulsing background flash
      const pulse = Math.sin(now / 100) * 0.5 + 0.5;
      ctx.fillStyle = `rgba(255, ${50 + pulse * 50}, 0, ${0.03 + pulse * 0.02})`;
      ctx.fillRect(0, 0, width, height);

      ctx.save();
      // Pulsing text size - responsive
      const textScale = 1 + Math.sin(now / 150) * 0.1;
      const baseFontSize = Math.max(36, Math.floor(72 * minScale));
      const fontSize = Math.floor(baseFontSize * textScale);
      ctx.font = `bold ${fontSize}px "Cinzel", serif`;
      ctx.textAlign = 'center';

      // Rainbow cycling with glow
      ctx.fillStyle = `hsl(${(now / 15) % 360}, 100%, 60%)`;
      ctx.shadowColor = `hsl(${(now / 15 + 180) % 360}, 100%, 50%)`;
      ctx.shadowBlur = (30 + Math.sin(now / 100) * 15) * minScale;

      const textY = height * 0.35;
      ctx.fillText('GRAND FINALE!', width / 2, textY);

      // Secondary glow layer
      ctx.shadowColor = '#FFD700';
      ctx.shadowBlur = 20 * minScale;
      ctx.fillText('GRAND FINALE!', width / 2, textY);
      ctx.restore();
      ctx.globalCompositeOperation = 'lighter';
    }

    // Normal hand tracking
    ['Left', 'Right'].forEach(hand => {
      const state = handStateRef.current[hand];
      const pos = handPosRef.current[hand];
      const screenX = (1 - pos.x) * width; // Mirror X
      const screenY = pos.y * height;

      // Draw Hand Indicator - Gold when open, Red when fist
      if (state !== HandState.UNKNOWN) {
          ctx.beginPath();
          ctx.arc(screenX, screenY, bothHandsOpen ? 15 : 10, 0, Math.PI * 2);
          ctx.fillStyle = state === HandState.OPEN ? '#FFD700' : '#FF4400';
          ctx.fill();
      }

      // Normal trigger (only when NOT in grand finale)
      if (!bothHandsOpen) {
        const prevState = prevHandStateRef.current[hand];
        const justOpened = state === HandState.OPEN && prevState !== HandState.OPEN;
        if (justOpened && now - lastTriggerTime.current[hand] > 250) {
          triggerFirework(screenX, screenY);
          lastTriggerTime.current[hand] = now;
        }
      }
      prevHandStateRef.current[hand] = state;
    });

    // 6. Update and draw particles (in-place cleanup)
    let writeIdx = 0;
    for (let i = 0; i < particles.current.length; i++) {
      const p = particles.current[i];
      p.update();
      p.draw(ctx);
      if (!p.isDead()) {
        particles.current[writeIdx++] = p;
      }
    }
    particles.current.length = writeIdx;

    // Reset blend mode
    ctx.globalCompositeOperation = 'source-over';
  };

  return (
    <>
      <video 
        ref={videoRef} 
        style={{ display: 'none' }} 
        playsInline 
        muted
        autoPlay
      />
      <canvas 
        ref={canvasRef} 
        className="absolute top-0 left-0 w-full h-full cursor-none"
      />
    </>
  );
};

export default GameCanvas;