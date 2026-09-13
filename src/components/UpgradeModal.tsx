import {
  Activity, ArrowRight, Crosshair, Droplet, Flame, Gauge, Heart,
  Magnet, Shield, Split, Star, Swords, Wind, Zap, Rocket,
  Orbit, Axe, Skull, Sparkles, Siren, Shell, HeartPulse,
} from 'lucide-react';
import type { UpgradeDef } from '../game/types';

interface Props {
  choices: UpgradeDef[];
  level: number;
  onPick: (id: string) => void;
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
};

const TIER_STYLE: Record<string, string> = {
  common: 'border-cyan-400/25 from-cyan-400/10 to-transparent',
  rare: 'border-violet-400/40 from-violet-500/15 to-transparent',
  epic: 'border-amber-300/50 from-amber-400/15 to-transparent',
};

const TIER_LABEL: Record<string, string> = {
  common: 'معمولی',
  rare: 'کمیاب',
  epic: 'حماسی',
};

export default function UpgradeModal({ choices, level, onPick }: Props) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="anim-rise w-full max-w-3xl">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-lime-300/40 bg-lime-400/10 px-4 py-1 text-xs font-bold text-lime-200">
            <Star size={14} /> لول {level}! یک ارتقا انتخاب کن
          </div>
          <h2 className="mt-3 text-2xl font-black text-white">قدرتت را انتخاب کن</h2>
          <p className="mt-1 text-xs text-slate-400" dir="ltr">
            choose 1 of 3 · stacked upgrades
          </p>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {choices.map((c, i) => {
            const Icon = ICONS[c.icon] ?? Zap;
            return (
              <button
                key={c.id}
                onClick={() => onPick(c.id)}
                className={`btn-neon group rounded-2xl border bg-gradient-to-b p-5 text-right ${TIER_STYLE[c.tier]}`}
                style={{ animationDelay: `${i * 70}ms` }}
              >
                <div className="flex items-center justify-between">
                  <span className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-bold text-slate-200">
                    {TIER_LABEL[c.tier]}
                  </span>
                  <span className="font-display text-[11px] text-slate-500" dir="ltr">
                    0{i + 1}
                  </span>
                </div>
                <div className="mt-3 inline-flex rounded-xl bg-white/8 p-3 text-cyan-200 transition-transform group-hover:scale-110">
                  <Icon size={26} />
                </div>
                <div className="mt-3 font-black text-white">{c.nameFa}</div>
                <div className="font-display text-[11px] tracking-wider text-slate-400" dir="ltr">
                  {c.nameEn}
                </div>
                <div className="mt-2 text-[12px] leading-6 text-slate-300">{c.descFa}</div>
                <div className="mt-3 text-[11px] font-bold text-cyan-300 opacity-0 transition-opacity group-hover:opacity-100">
                  کلیک برای انتخاب ←
                </div>
              </button>
            );
          })}
        </div>
        <p className="mt-4 text-center text-[11px] text-slate-500">
          کلیدهای <kbd className="key">1</kbd> <kbd className="key">2</kbd> <kbd className="key">3</kbd> هم کار می‌کنند
        </p>
      </div>
    </div>
  );
}
