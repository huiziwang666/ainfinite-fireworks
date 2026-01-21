import React, { useState, useRef } from 'react';
import GameCanvas from './components/GameCanvas';

const App = () => {
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStart = async () => {
    setLoading(true);
    setError(null);
    try {
      await navigator.mediaDevices.getUserMedia({ video: true });

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      if(ctx.state === 'suspended') {
        await ctx.resume();
      }

      // Request fullscreen
      try {
        await document.documentElement.requestFullscreen();
      } catch (e) {
        console.log('Fullscreen not supported or denied');
      }

      setStarted(true);
    } catch (err) {
      console.error(err);
      setError("Camera access denied. Please allow camera access to play.");
    } finally {
      setLoading(false);
    }
  };

  if (!started) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-900 text-yellow-400 font-serif relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-red-950 via-red-950/50 to-black opacity-95"></div>

        <div className="relative z-10 text-center p-8 border-2 border-yellow-500/40 rounded-2xl bg-red-950/60 backdrop-blur-md max-w-lg shadow-[0_0_80px_rgba(255,50,0,0.3)]">
          <div className="flex flex-col items-center mb-6">
            <img src="/new-logo.png" alt="AInfinite Logo" className="w-20 h-20 object-contain mb-3" />
            <h1 className="text-4xl font-bold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-400 to-red-500 drop-shadow-lg">
              AInfinite Fireworks
            </h1>
          </div>
          <h2 className="text-2xl mb-2 text-yellow-300/90 tracking-widest">YEAR OF THE HORSE 2026</h2>
          <h3 className="text-lg mb-8 text-orange-300/70 tracking-wider">Lunar New Year Celebration</h3>

          <div className="space-y-6 mb-8 text-lg text-orange-100">
            <div className="flex items-center justify-center space-x-4">
              <span className="text-3xl">🐴</span>
              <p>Make a <span className="text-yellow-400 font-bold">Fist</span> then <span className="text-red-400 font-bold">Open</span> to ignite!</p>
            </div>
            <p className="text-sm text-orange-300/60">Each burst brings good fortune!</p>
          </div>

          {error && (
             <div className="mb-4 p-3 bg-red-900/50 border border-red-500 text-red-200 rounded">
               {error}
             </div>
          )}

          <button
            onClick={handleStart}
            disabled={loading}
            className="px-10 py-4 bg-gradient-to-r from-red-600 to-orange-500 text-yellow-100 font-bold text-xl rounded-full hover:from-red-500 hover:to-orange-400 transform hover:scale-105 transition-all shadow-[0_0_30px_rgba(255,100,0,0.5)] border border-yellow-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Loading..." : "START CELEBRATION"}
          </button>

          <p className="mt-6 text-xs text-orange-400/40 font-mono">CAMERA FEED PROCESSED LOCALLY</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      <GameCanvas onHandsDetected={setCameraActive} />
      
      {!cameraActive && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-cyan-500/80 text-xl font-mono animate-pulse tracking-widest">
          WAITING FOR HAND SIGNAL...
        </div>
      )}
    </div>
  );
};

export default App;