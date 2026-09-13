import { Home, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react';

interface Props {
  muted: boolean;
  onResume: () => void;
  onRestart: () => void;
  onMenu: () => void;
  onToggleMute: () => void;
}

export default function PauseMenu({ muted, onResume, onRestart, onMenu, onToggleMute }: Props) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="glass anim-rise w-full max-w-sm rounded-3xl p-7 text-center">
        <h2 className="text-2xl font-black text-white">مکث</h2>
        <p className="font-display mt-1 text-[11px] tracking-[0.3em] text-slate-500" dir="ltr">
          PAUSED
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <button
            onClick={onResume}
            className="btn-neon inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-cyan-400 to-sky-500 px-5 py-3 text-sm font-black text-slate-950"
          >
            <Play size={17} /> ادامه نبرد
          </button>
          <button
            onClick={onRestart}
            className="btn-neon inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-bold text-white"
          >
            <RotateCcw size={16} /> شروع دوباره
          </button>
          <div className="flex gap-2">
            <button
              onClick={onMenu}
              className="btn-neon flex-1 inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-bold text-white"
            >
              <Home size={16} /> منو
            </button>
            <button
              onClick={onToggleMute}
              className="btn-neon inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-bold text-white"
              aria-label="mute"
            >
              {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
          </div>
        </div>
        <p className="mt-4 text-[11px] leading-5 text-slate-500">
          <kbd className="key">Esc</kbd> یا <kbd className="key">P</kbd> برای ادامه
        </p>
      </div>
    </div>
  );
}
