import {
  Play, Settings, Trophy, Volume2, VolumeX, Gamepad2, Shield,
  Star, Rocket, Ghost, Anchor, Medal, Swords, Timer, Layers,
  Droplet, Sparkles, Crown, Skull, Orbit, Award, Crosshair,
  FlaskConical, Gem, Hexagon, Snowflake, HeartPulse,
} from 'lucide-react';
import { SHIPS, type ShipDef, type ShipId } from '../game/types';
import type { BoardEntry, SavedSettings, Totals } from '../game/storage';
import type { MetaLevels } from '../game/types';
import { ACHIEVEMENTS, getUnlockedAchievements } from '../game/achievements';
import { formatTime } from '../game/utils';
import { useMemo } from 'react';

const ACH_ICON: Record<string, typeof Shield> = {
  droplet: Droplet,
  combo: Sparkles,
  crown: Crown,
  skull: Skull,
  shield: Shield,
  medal: Medal,
  nuke: Crosshair,
  orbit: Orbit,
  timer: Timer,
  hexagon: Hexagon,
  snowflake: Snowflake,
  heartpulse: HeartPulse,
};

interface Props {
  best: number;
  board: BoardEntry[];
  totals: Totals;
  settings: SavedSettings;
  shards: number;
  meta: MetaLevels;
  onPlay: () => void;
  onOpenSettings: () => void;
  onOpenLab: () => void;
  onToggleMute: () => void;
  onSelectShip: (s: ShipId) => void;
}

const DIFF_FA: Record<string, string> = {
  easy: 'آسان',
  normal: 'معمولی',
  hard: 'سخت',
  insane: 'جهنمی',
};

const SHIP_ICON: Record<ShipId, typeof Rocket> = {
  vanguard: Rocket,
  phantom: Ghost,
  titan: Anchor,
  warden: Shield,
};

function bar(v: number, min: number, max: number): number {
  return Math.max(8, Math.min(100, ((v - min) / (max - min)) * 100));
}

function ShipMeters({ s }: { s: ShipDef }) {
  const rows = [
    { label: 'جان', pct: bar(s.maxHp, 0.6, 1.9), val: s.maxHp },
    { label: 'سرعت', pct: bar(s.moveSpeed, 0.85, 1.22), val: s.moveSpeed },
    { label: 'دمیج', pct: bar(s.damage, 0.9, 1.15), val: s.damage },
  ];
  return (
    <div className="mt-2.5 space-y-1.5">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2">
          <span className="w-7 shrink-0 text-[9px] font-bold text-slate-500">{r.label}</span>
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
            <div className="h-full rounded-full bg-gradient-to-l from-slate-200 to-slate-400" style={{ width: `${r.pct}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function MainMenu({ best, board, totals, settings, shards, meta, onPlay, onOpenSettings, onOpenLab, onToggleMute, onSelectShip }: Props) {
  const unlocked = useMemo(() => getUnlockedAchievements(), []);
  const metaTotal = meta.dmg + meta.hp + meta.speed + meta.xp;
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <div className="menu-grid-bg anim-grid absolute inset-0" />
      <div className="anim-blob-a absolute -top-32 left-1/2 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-cyan-500/[0.09] blur-[110px]" />
      <div className="anim-blob-b absolute bottom-0 right-0 h-64 w-96 rounded-full bg-pink-600/[0.08] blur-[110px]" />
      <div className="anim-blob-c absolute top-1/3 left-0 h-56 w-72 rounded-full bg-violet-600/[0.08] blur-[100px]" />

      <div className="relative w-full max-w-4xl text-center">
        <div className="anim-rise chip mx-auto w-fit text-slate-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
          نسخه ۴ · هدف: فتح موج ۲۰
        </div>

        <h1
          className="font-display anim-title title-gradient mt-5 text-6xl font-black tracking-tight sm:text-7xl"
          dir="ltr"
        >
          NEON VOID
        </h1>
        <p className="mt-3 text-[15px] font-medium text-slate-400">آرنا سروایور نئونی — بقا در خلأ</p>

        {(best > 0 || totals.runs > 0) && (
          <div className="mx-auto mt-5 flex w-fit flex-wrap items-center justify-center gap-2">
            {best > 0 && (
              <span className="chip tabular border-amber-200/20 bg-amber-300/[0.07] text-amber-100" dir="ltr">
                <Trophy size={13} className="text-amber-300" />
                {best.toLocaleString('en-US')}
              </span>
            )}
            {totals.runs > 0 && (
              <>
                <span className="chip tabular">
                  <Swords size={13} className="text-slate-500" /> {totals.kills.toLocaleString('en-US')} کیل
                </span>
                <span className="chip tabular">
                  <Layers size={13} className="text-slate-500" /> موج {totals.bestWave}
                </span>
                <span className="chip tabular" dir="ltr">
                  <Timer size={13} className="text-slate-500" /> {formatTime(totals.time)}
                </span>
              </>
            )}
          </div>
        )}

        <div className="glass mt-7 rounded-3xl p-5 text-right sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="eyebrow" dir="ltr">SELECT SHIP</div>
            <div className="text-[11px] text-slate-500">هر کشتی یک سبک بازی</div>
          </div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {SHIPS.map((s, i) => {
              const Icon = SHIP_ICON[s.id];
              const active = settings.ship === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => onSelectShip(s.id)}
                  className={`card-hover anim-rise rounded-2xl border p-4 text-right ${
                    active
                      ? 'border-cyan-200/40 bg-cyan-300/[0.07]'
                      : 'border-white/[0.07] bg-white/[0.025]'
                  } stagger-${Math.min(4, i + 1)}`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="rounded-xl p-2"
                      style={{ color: s.color, backgroundColor: `${s.color}14` }}
                    >
                      <Icon size={20} />
                    </span>
                    <span
                      className={`h-2 w-2 rounded-full transition ${
                        active ? 'bg-cyan-300 shadow-[0_0_10px_rgba(0,240,255,0.8)]' : 'bg-white/15'
                      }`}
                    />
                  </div>
                  <div className="mt-3 text-[14px] font-extrabold text-white">{s.nameFa}</div>
                  <div className="font-display text-[10px] tracking-[0.18em] text-slate-500" dir="ltr">
                    {s.nameEn}
                  </div>
                  <ShipMeters s={s} />
                  <div className="mt-2.5 line-clamp-2 min-h-8 text-[11px] leading-5 text-slate-400">{s.descFa}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="glass mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3.5 text-right">
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-white/[0.05] p-2.5 text-slate-300">
              <FlaskConical size={18} />
            </span>
            <div>
              <div className="text-[13px] font-extrabold text-white">آزمایشگاه خلأ</div>
              <div className="text-[11px] text-slate-500">
                ارتقای دائمی · {metaTotal} لول فعال
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="chip tabular text-slate-200" dir="ltr">
              <Gem size={13} className="text-cyan-300" /> {shards.toLocaleString('en-US')}
            </span>
            <button
              onClick={onOpenLab}
              className="btn-neon btn-ghost rounded-xl px-4 py-2 text-xs font-bold"
            >
              ورود
            </button>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
          <button
            onClick={onPlay}
            className="btn-neon btn-primary group inline-flex items-center gap-2.5 rounded-2xl px-10 py-4 text-[17px] font-black"
          >
            <Play size={20} className="transition-transform group-hover:scale-110" />
            شروع نبرد
          </button>
          <button
            onClick={onOpenSettings}
            className="btn-neon btn-ghost inline-flex items-center gap-2 rounded-2xl px-5 py-4 text-[13px] font-bold"
          >
            <Settings size={17} className="text-slate-400" />
            تنظیمات
            <span className="rounded-md bg-white/[0.07] px-2 py-0.5 text-[11px] text-slate-300">
              {DIFF_FA[settings.difficulty]}
            </span>
          </button>
          <button
            onClick={onToggleMute}
            className="btn-neon btn-ghost inline-flex items-center rounded-2xl px-4 py-4"
            aria-label="mute"
          >
            {settings.muted ? <VolumeX size={18} className="text-slate-400" /> : <Volume2 size={18} className="text-slate-300" />}
          </button>
        </div>

        {board.length > 0 && (
          <div className="glass mt-4 rounded-2xl p-4 text-right">
            <div className="mb-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Medal size={14} className="text-amber-200/80" />
                <span className="text-xs font-extrabold text-slate-200">تابلوی افتخار</span>
              </div>
              <span className="eyebrow" dir="ltr">TOP 5</span>
            </div>
            <div className="space-y-1">
              {board.map((b, i) => (
                <div
                  key={`${b.date}-${i}`}
                  className="flex items-center justify-between rounded-xl px-3 py-2 text-[12px] odd:bg-white/[0.025]"
                >
                  <span className="font-display tabular font-bold text-slate-100" dir="ltr">
                    <span className={i === 0 ? 'text-amber-200' : 'text-slate-600'}>#{i + 1}</span>{' '}
                    {b.score.toLocaleString('en-US')}
                  </span>
                  <span className="tabular text-slate-500">
                    موج {b.wave} · {b.kills} کیل · {formatTime(b.time)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="glass mt-4 rounded-2xl p-4 text-right">
          <div className="mb-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award size={14} className="text-slate-400" />
              <span className="text-xs font-extrabold text-slate-200">اچیومنت‌ها</span>
            </div>
            <span className="font-display tabular text-[11px] text-slate-500" dir="ltr">
              {unlocked.size}/{ACHIEVEMENTS.length}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
            {ACHIEVEMENTS.map((a) => {
              const Icon = ACH_ICON[a.icon] ?? Sparkles;
              const has = unlocked.has(a.id);
              return (
                <div
                  key={a.id}
                  title={`${a.nameFa} — ${a.descFa}`}
                  className={`flex flex-col items-center gap-1.5 rounded-xl px-1 py-2.5 text-center transition ${
                    has
                      ? 'bg-amber-200/[0.07] text-amber-100/90'
                      : 'bg-white/[0.02] text-slate-700'
                  }`}
                >
                  <Icon size={16} strokeWidth={has ? 2.2 : 1.6} />
                  <span className="text-[9px] font-bold leading-3">{a.nameFa}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2.5 text-right sm:grid-cols-3">
          {[
            { icon: Gamepad2, tint: 'text-cyan-200 bg-cyan-300/10', title: 'حرکت و شلیک', body: 'WASD حرکت · موس aim · شلیک خودکار · هر لول یک ری‌رول' },
            { icon: Shield, tint: 'text-rose-200 bg-rose-400/10', title: 'دش و پاورآپ', body: 'Shift دش · سپر، مگنت، نیوک، یخبندان و اور‌درایو' },
            { icon: Star, tint: 'text-amber-200 bg-amber-300/10', title: 'پیشرفت', body: 'الیت ۵× تجربه · باس هر ۵ موج · هر اچیومنت ۳ خرده · فتح موج ۲۰ پیروزی است' },
          ].map((c) => (
            <div key={c.title} className="glass rounded-2xl p-4">
              <div className="flex items-center gap-2">
                <span className={`rounded-lg p-1.5 ${c.tint}`}>
                  <c.icon size={15} />
                </span>
                <span className="text-xs font-extrabold text-slate-200">{c.title}</span>
              </div>
              <p className="mt-2 text-[11.5px] leading-6 text-slate-400">{c.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 text-[11px] text-slate-600">WASD · موس · Shift دش · P مکث · ۱/۲/۳ انتخاب ارتقا</p>
      </div>
    </div>
  );
}
