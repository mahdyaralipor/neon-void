import {
  Activity, ArrowRight, Crosshair, Droplet, Flame, Gauge, Heart,
  Magnet, Shield, Split, Star, Swords, Wind, Zap, Rocket,
  Orbit, Axe, Skull, Sparkles, Siren, Shell, HeartPulse, Dices,
} from 'lucide-react';
import type { UpgradeDef } from '../game/types';
import { UPGRADE_MAP } from '../game/upgrades';

interface Props {
  choices: UpgradeDef[];
  level: number;
  taken: Record<string, number>;
  rerollsLeft: number;
  onPick: (id: string) => void;
  onReroll: () => void;
  onSkip: () => void;
}

const ICONS: Record<string, typeof Zap> = {
  swords: Swords,
  zap: Zap,
  split: Split,
  arrow: ArrowRight,
  wind: Wind,
  crosshair: Crosshair,
  gauge: Gauge,
  heart: Heart,
  pulse: Activity,
  magnet: Magnet,
  shield: Shield,
  dash: Rocket,
  star: Star,
  droplet: Droplet,
  flame: Flame,
  orbit: Orbit,
  axe: Axe,
  skull: Skull,
  combo: Sparkles,
  siren: Siren,
  thorns: Shell,
  nova: Sparkles,
  seeker: Rocket,
  secondwind: HeartPulse,
  chain: Zap,
  headhunter: Crosshair,
  phasedive: Wind,
  sniper: Crosshair,
  fortress: Shield,
};

const TIER_CARD: Record<string, string> = {
  common: 'border-white/[0.09] hover:border-slate-300/40',
  rare: 'border-violet-300/30 hover:border-violet-300/60 shadow-[0_0_24px_rgba(177,75,255,0.12)]',
  epic: 'border-amber-200/40 hover:border-amber-200/70 shadow-[0_0_32px_rgba(255,211,25,0.18)]',
};

const TIER_DOT: Record<string, string> = {
  common: 'bg-slate-300',
  rare: 'bg-violet-300',
  epic: 'bg-amber-200',
};

const TIER_TILE: Record<string, string> = {
  common: 'bg-white/[0.05] text-slate-200',
  rare: 'bg-violet-300/10 text-violet-100',
  epic: 'bg-amber-200/10 text-amber-100',
};

const TIER_LABEL: Record<string, string> = {
  common: 'معمولی',
  rare: 'کمیاب',
  epic: 'حماسی',
};

export default function UpgradeModal({ choices, level, taken, rerollsLeft, onPick, onReroll, onSkip }: Props) {
  const ownedCount = Object.keys(taken).length;
  return (
    <div className="scanlines absolute inset-0 z-30 flex items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-lg">
      <div className="anim-rise my-auto w-full max-w-3xl">
        <div className="text-center">
          <div className="chip tabular mx-auto w-fit !border-amber-200/25 !bg-amber-200/[0.08] !text-amber-100 shadow-[0_0_24px_rgba(255,211,25,0.2)]" dir="ltr">
            <Star size={12} className="text-amber-200" fill="currentColor" /> LEVEL {level} — POWER SURGE
          </div>
          <h2 className="neon-text mt-3 text-[26px] font-black tracking-tight text-white">یک ارتقا انتخاب کن</h2>
          <p className="mt-1 text-[12px] text-slate-400">هر انتخاب بیلدت را شکل می‌دهد — استک می‌شود · <span className="text-cyan-300">حماسی = بازی‌عوض‌کن</span></p>
          <div className="mt-3 flex items-center justify-center gap-2.5">
            <button
              onClick={onReroll}
              disabled={rerollsLeft <= 0}
              className={`btn-neon inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-[11px] font-bold transition ${
                rerollsLeft > 0
                  ? 'border-white/12 bg-white/[0.05] text-slate-200 hover:bg-white/[0.09]'
                  : 'cursor-not-allowed border-white/[0.06] bg-transparent text-slate-600'
              }`}
            >
              <Dices size={13} />
              {rerollsLeft > 0 ? `تاس دوباره (${rerollsLeft})` : 'تاس تمام شد'}
            </button>
            {ownedCount > 0 && (
              <span className="tabular text-[11px] text-slate-500">{ownedCount} ارتقای فعال</span>
            )}
          </div>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {choices.map((c, i) => {
            const Icon = ICONS[c.icon] ?? Zap;
            const stacks = taken[c.id] ?? 0;
            const maxed = UPGRADE_MAP[c.id]?.maxStacks ?? 0;
            return (
              <button
                key={c.id}
                onClick={() => onPick(c.id)}
                className={`btn-neon card-hover card-shine group rounded-2xl border bg-gradient-to-b from-white/[0.07] to-transparent p-5 text-right ${TIER_CARD[c.tier]} ${c.tier === 'epic' ? 'rarity-epic' : c.tier === 'rare' ? 'rarity-rare' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                    <span className={`h-1.5 w-1.5 rounded-full ${TIER_DOT[c.tier]}`} />
                    {TIER_LABEL[c.tier]}
                  </span>
                  <span className="font-display tabular text-[11px] text-slate-600" dir="ltr">
                    {i + 1}
                  </span>
                </div>
                <div className={`mt-3.5 inline-flex rounded-xl p-3 transition-transform group-hover:scale-105 ${TIER_TILE[c.tier]}`}>
                  <Icon size={24} strokeWidth={1.9} />
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="text-[14.5px] font-extrabold text-white">{c.nameFa}</span>
                  {stacks > 0 && (
                    <span className="font-display tabular shrink-0 rounded-md bg-white/[0.07] px-1.5 py-0.5 text-[10px] font-bold text-slate-300" dir="ltr">
                      {stacks + 1}{maxed > 0 ? `/${maxed}` : ''}
                    </span>
                  )}
                </div>
                <div className="font-display text-[10px] tracking-[0.14em] text-slate-500" dir="ltr">
                  {c.nameEn.toUpperCase()}
                </div>
                <div className="mt-2 min-h-12 text-[12px] leading-6 text-slate-400">{c.descFa}</div>
              </button>
            );
          })}
        </div>
        <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[11px] text-slate-600">
          <kbd className="key">1</kbd> <kbd className="key">2</kbd> <kbd className="key">3</kbd>
          <span className="mr-1">با کیبورد هم می‌شود انتخاب کرد</span>
        </p>
        <div className="mt-2 text-center">
          <button
            onClick={onSkip}
            className="btn-neon rounded-full px-4 py-1.5 text-[11px] font-bold text-slate-500 transition hover:text-slate-300"
          >
            رد کردن <span className="text-emerald-300/80">(+۲۰ جان)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
