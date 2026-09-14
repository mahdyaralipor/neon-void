import { Home, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import type { HudSnapshot } from '../game/types';
import { UPGRADE_MAP } from '../game/upgrades';

interface Props {
  muted: boolean;
  hud: HudSnapshot | null;
  taken: Record<string, number>;
  onResume: () => void;
  onRestart: () => void;
  onMenu: () => void;
  onToggleMute: () => void;
}

export default function PauseMenu({ muted, hud, taken, onResume, onRestart, onMenu, onToggleMute }: Props) {
  const buildIds = Object.keys(taken);
  const dps = hud
    ? Math.round(hud.damage * hud.fireRate * Math.max(1, hud.multishot) * (1 + hud.critChance * (hud.critMult - 1)))
    : null;
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-md">
      <div className="glass anim-rise my-auto w-full max-w-sm rounded-3xl p-6 text-center sm:p-7">
        <div className="eyebrow" dir="ltr">PAUSED</div>
        <h2 className="mt-1.5 text-[22px] font-extrabold tracking-tight text-white">مکث</h2>
        {hud && (
          <div className="tabular mt-4 grid grid-cols-3 gap-2 text-center" dir="ltr">
            <div className="rounded-xl bg-white/[0.035] px-2 py-2.5">
              <div className="font-display text-[13px] font-bold text-white">{hud.damage.toFixed(0)}</div>
              <div className="eyebrow mt-0.5 !text-[8.5px]">DMG</div>
            </div>
            <div className="rounded-xl bg-white/[0.035] px-2 py-2.5">
              <div className="font-display text-[13px] font-bold text-white">{dps !== null ? dps : '—'}</div>
              <div className="eyebrow mt-0.5 !text-[8.5px]" dir="ltr">DPS{ hud ? ` · ${hud.fireRate.toFixed(1)}/s` : ''}</div>
            </div>
            <div className="rounded-xl bg-white/[0.035] px-2 py-2.5">
              <div className="font-display text-[13px] font-bold text-white">W{hud.wave}</div>
              <div className="eyebrow mt-0.5 !text-[8.5px]">{hud.kills} KILLS</div>
            </div>
          </div>
        )}
        {hud && (hud.mods.nova > 0 || hud.mods.chain > 0 || hud.orbitals > 0) && (
          <p className="mt-1.5 text-[10px] text-slate-600">بدون احتساب نووا / زنجیره / تیغه — DPS واقعی بیشتر است</p>
        )}
        {buildIds.length > 0 && (
          <div className="mt-2.5 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 text-right">
            <div className="mb-2 text-[11px] font-extrabold text-slate-300">بیلد فعلی</div>
            <div className="flex flex-wrap gap-1.5">
              {buildIds.map((id) => (
                <span
                  key={id}
                  className="tabular rounded-lg bg-white/[0.05] px-2 py-1 text-[10.5px] font-bold text-slate-300"
                >
                  {UPGRADE_MAP[id]?.nameFa ?? id} · {taken[id]}
                </span>
              ))}
            </div>
          </div>
        )}
        <div className="mt-4 flex flex-col gap-2">
          <button
            onClick={onResume}
            className="btn-neon btn-primary inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-black"
          >
            <Play size={17} /> ادامه نبرد
          </button>
          <button
            onClick={onRestart}
            className="btn-neon btn-ghost inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-[13px] font-bold"
          >
            <RotateCcw size={15} className="text-slate-400" /> شروع دوباره
          </button>
          <div className="flex gap-2">
            <button
              onClick={onMenu}
              className="btn-neon btn-ghost flex-1 inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-[13px] font-bold"
            >
              <Home size={15} className="text-slate-400" /> منو
            </button>
            <button
              onClick={onToggleMute}
              className="btn-neon btn-ghost inline-flex items-center justify-center rounded-2xl px-5 py-3"
              aria-label="mute"
            >
              {muted ? <VolumeX size={16} className="text-slate-500" /> : <Volume2 size={16} className="text-slate-300" />}
            </button>
          </div>
        </div>
        <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-slate-600">
          <kbd className="key">Esc</kbd> ادامه
        </p>
      </div>
    </div>
  );
}
