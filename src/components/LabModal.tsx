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
    <div className="absolute inset-0 z-40 flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-md">
      <div className="glass anim-rise my-auto w-full max-w-lg rounded-3xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-white/[0.05] p-2.5 text-slate-200">
              <FlaskConical size={18} />
            </span>
            <div>
              <div className="eyebrow" dir="ltr">VOID LAB</div>
              <h2 className="mt-0.5 text-lg font-extrabold tracking-tight text-white">آزمایشگاه خلأ</h2>
            </div>
          </div>
          <button onClick={onClose} className="btn-neon btn-ghost rounded-xl p-2" aria-label="close">
            <X size={17} />
          </button>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className="chip tabular !text-slate-100" dir="ltr">
            <Gem size={13} className="text-slate-300" /> {shards.toLocaleString('en-US')}
          </span>
          <span className="text-[11px] text-slate-500">الیت ۱◇ · باس ۵◇ · اچیومنت ۳◇</span>
        </div>

        <div className="mt-4 space-y-2">
          {META_TRACKS.map((t) => {
            const Icon = TRACK_ICON[t.id];
            const lvl = meta[t.id];
            const maxed = lvl >= META_MAX_LEVEL;
            const cost = metaCost(lvl);
            const afford = shards >= cost;
            const pct = t.id === 'dmg' ? lvl * 2 : t.id === 'hp' ? lvl * 2 : t.id === 'speed' ? lvl * 1 : lvl * 3;
            return (
              <div key={t.id} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="rounded-xl bg-white/[0.05] p-2 text-slate-200">
                      <Icon size={17} strokeWidth={1.9} />
                    </span>
                    <div className="text-right">
                      <div className="text-[13.5px] font-extrabold text-white">
                        {t.nameFa}{' '}
                        {lvl > 0 && (
                          <span className="tabular text-[11px] font-bold text-emerald-200/90" dir="ltr">+{pct}%</span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500">{t.descFa} · <span className="tabular" dir="ltr">{lvl}/{META_MAX_LEVEL}</span></div>
                    </div>
                  </div>
                  <button
                    onClick={() => onBuy(t.id)}
                    disabled={maxed || !afford}
                    className={`btn-neon tabular shrink-0 rounded-xl px-4 py-2 text-xs font-black ${
                      maxed
                        ? 'bg-white/[0.06] text-slate-500'
                        : afford
                          ? 'btn-primary'
                          : 'cursor-not-allowed bg-white/[0.04] text-slate-600'
                    }`}
                  >
                    {maxed ? 'MAX' : (
                      <span className="inline-flex items-center gap-1" dir="ltr">
                        <Gem size={11} /> {cost}
                      </span>
                    )}
                  </button>
                </div>
                <div className="mt-2.5 flex gap-1" dir="ltr">
                  {Array.from({ length: META_MAX_LEVEL }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full ${i < lvl ? 'bg-slate-200' : 'bg-white/[0.08]'}`}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <button
          onClick={onClose}
          className="btn-neon btn-primary mt-5 w-full rounded-2xl px-5 py-3 text-sm font-black"
        >
          تأیید
        </button>
      </div>
    </div>
  );
}
