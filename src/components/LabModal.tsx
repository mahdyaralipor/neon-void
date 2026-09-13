import { X, Swords, Heart, Gauge, Star, Gem, FlaskConical, Zap } from 'lucide-react';
import { META_TRACKS, META_MAX_LEVEL, metaCost, type MetaLevels } from '../game/types';

interface Props {
  meta: MetaLevels;
  shards: number;
  onBuy: (track: keyof MetaLevels) => void;
  onClose: () => void;
}

const TRACK_ICON: Record<keyof MetaLevels, typeof Zap> = {
  dmg: Swords,
  hp: Heart,
  speed: Gauge,
  xp: Star,
};

export default function LabModal({ meta, shards, onBuy, onClose }: Props) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm">
      <div className="glass anim-rise my-auto w-full max-w-lg rounded-3xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="rounded-xl bg-cyan-400/10 p-2 text-cyan-300">
              <FlaskConical size={18} />
            </span>
            <div>
              <h2 className="text-lg font-black text-white">آزمایشگاه خلأ</h2>
              <p className="text-[11px] text-slate-400">ارتقای دائمی — در همه ران‌ها فعال می‌ماند</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg bg-white/5 p-2 text-slate-300 hover:bg-white/10" aria-label="close">
            <X size={17} />
          </button>
        </div>

        <div className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-4 py-1.5 text-sm font-black text-cyan-200">
          <Gem size={15} /> موجودی: <span className="font-display" dir="ltr">{shards.toLocaleString('en-US')}</span> خرده
        </div>
        <p className="mt-1.5 text-[11px] text-slate-500">خرده‌ها از الیت‌ها (۱◇) و باس‌ها (۵◇) به دست می‌آیند</p>

        <div className="mt-4 space-y-2.5">
          {META_TRACKS.map((t) => {
            const Icon = TRACK_ICON[t.id];
            const lvl = meta[t.id];
            const maxed = lvl >= META_MAX_LEVEL;
            const cost = metaCost(lvl);
            const afford = shards >= cost;
            return (
              <div key={t.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="rounded-lg bg-white/8 p-2 text-cyan-200">
                      <Icon size={18} />
                    </span>
                    <div className="text-right">
                      <div className="text-sm font-black text-white">{t.nameFa}</div>
                      <div className="text-[11px] text-slate-400">{t.descFa}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => onBuy(t.id)}
                    disabled={maxed || !afford}
                    className={`btn-neon shrink-0 rounded-xl px-4 py-2 text-xs font-black ${
                      maxed
                        ? 'bg-white/10 text-slate-400'
                        : afford
                          ? 'bg-gradient-to-l from-cyan-400 to-sky-500 text-slate-950'
                          : 'cursor-not-allowed bg-white/5 text-slate-500'
                    }`}
                  >
                    {maxed ? 'MAX' : (
                      <span className="inline-flex items-center gap-1" dir="ltr">
                        <Gem size={12} /> {cost}
                      </span>
                    )}
                  </button>
                </div>
                <div className="mt-2 flex gap-1" dir="ltr">
                  {Array.from({ length: META_MAX_LEVEL }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-1.5 flex-1 rounded-full ${i < lvl ? 'bg-cyan-300 shadow-[0_0_6px_rgba(0,240,255,0.7)]' : 'bg-white/10'}`}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <button
          onClick={onClose}
          className="btn-neon mt-5 w-full rounded-2xl bg-gradient-to-l from-cyan-400 to-sky-500 px-5 py-3 text-sm font-black text-slate-950"
        >
          تأیید
        </button>
      </div>
    </div>
  );
}
