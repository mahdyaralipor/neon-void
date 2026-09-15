import {
  Play, Settings, Trophy, Volume2, VolumeX, Gamepad2, Shield,
  Star, Rocket, Ghost, Anchor, Medal, Swords, Timer, Layers,
  Droplet, Sparkles, Crown, Skull, Orbit, Award, Crosshair,
  FlaskConical, Gem, Hexagon, Snowflake, HeartPulse, BookOpen,
  History, Infinity as InfinityIcon, Compass, Radiation,
} from 'lucide-react';
import { SHIPS, type ShipDef, type ShipId } from '../game/types';
import { getRuns, type BoardEntry, type SavedSettings, type Totals } from '../game/storage';
import type { MetaLevels } from '../game/types';
import { ACHIEVEMENTS, getUnlockedAchievements } from '../game/achievements';
import { ENEMY_COLOR, ENEMY_FA, ENEMY_LORE, isBossKind } from '../game/enemies';
import { UPGRADE_POOL } from '../game/upgrades';
import { MUTATORS } from '../game/types';
import pkg from '../../package.json';
import type { EnemyKind } from '../game/types';
import { formatTime } from '../game/utils';
import MenuBackdrop from './MenuBackdrop';
import EnemyIcon from './EnemyIcon';
import EnemyDetailModal from './EnemyDetailModal';
import { useMemo, useState } from 'react';

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
  gem: Gem,
  ghost: Ghost,
  void: Radiation,
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
  onToggleCoop: () => void;
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
  nomad: Compass,
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

export default function MainMenu({ best, board, totals, settings, shards, meta, onPlay, onOpenSettings, onOpenLab, onToggleMute, onSelectShip, onToggleCoop }: Props) {
  const unlocked = useMemo(() => getUnlockedAchievements(), []);
  const runs = useMemo(() => getRuns(), []);
  const metaTotal = meta.dmg + meta.hp + meta.speed + meta.xp;
  const codexKinds = useMemo(() => Object.keys(ENEMY_COLOR) as EnemyKind[], []);
  const codexRegulars = useMemo(() => codexKinds.filter((k) => !isBossKind(k)), [codexKinds]);
  const codexBosses = useMemo(() => codexKinds.filter((k) => isBossKind(k)), [codexKinds]);
  const [selectedKind, setSelectedKind] = useState<EnemyKind | null>(null);
  // co-op needs a physical keyboard — P2 flies with arrows + Enter
  const coarsePointer = useMemo(() => {
    try {
      return window.matchMedia?.('(pointer: coarse)').matches ?? false;
    } catch {
      return false;
    }
  }, []);
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <MenuBackdrop />
      <div className="menu-grid-bg anim-grid absolute inset-0" />
      <div className="anim-blob-a absolute -top-32 left-1/2 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-cyan-500/[0.09] blur-[110px]" />
      <div className="anim-blob-b absolute bottom-0 right-0 h-64 w-96 rounded-full bg-pink-600/[0.08] blur-[110px]" />
      <div className="anim-blob-c absolute top-1/3 left-0 h-56 w-72 rounded-full bg-violet-600/[0.08] blur-[100px]" />

      <div className="relative w-full max-w-4xl text-center">
        <div className="anim-rise chip mx-auto w-fit !border-cyan-300/25 !bg-cyan-300/[0.08] text-cyan-100 shadow-[0_0_24px_rgba(0,240,255,0.18)]">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-300" />
          </span>
          نسخه {pkg.version} · بکش، بترکون، برگرد ♾️
        </div>

        <div className="relative mx-auto mt-5 w-fit">
          <div className="anim-pulse-ring absolute inset-0 rounded-full bg-cyan-400/10 blur-2xl" />
          <h1
            className="font-display anim-title title-gradient relative text-7xl font-black tracking-tight sm:text-8xl"
            dir="ltr"
          >
            NEON VOID
          </h1>
          <div className="pointer-events-none absolute -inset-6 -z-10 bg-[radial-gradient(ellipse_at_center,rgba(0,240,255,0.14),transparent_65%)] blur-xl" />
        </div>
        <p className="mt-3 text-[15px] font-medium text-slate-200">آرنا سروایور نئونی — <span className="neon-text font-bold text-cyan-200">هر ۳۰ ثانیه یه لول، هر موج یه غافلگیری</span></p>
        <p className="mt-1.5 text-[12.5px] text-slate-400">⚡ صاعقه زنجیره‌ای · 💨 شیرجه فاز · 🌩️ طوفان خلأ · ♾️ بی‌پایان بعد پیروزی</p>

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
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
            {SHIPS.map((s, i) => {
              const Icon = SHIP_ICON[s.id];
              const active = settings.ship === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => onSelectShip(s.id)}
                  className={`card-hover anim-rise rounded-2xl border p-4 text-right ${
                    active
                      ? 'border-cyan-200/50 bg-cyan-300/[0.09] shadow-[0_0_32px_rgba(0,240,255,0.18),inset_0_1px_0_rgba(255,255,255,0.1)]'
                      : 'border-white/[0.07] bg-white/[0.025]'
                  } stagger-${Math.min(5, i + 1)}`}
                  style={active ? { boxShadow: `0 0 32px ${s.color}33, inset 0 1px 0 rgba(255,255,255,0.1)` } : undefined}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="rounded-xl p-2 shadow-[0_0_18px_rgba(0,0,0,0.4)]"
                      style={{ color: s.color, backgroundColor: `${s.color}1f`, boxShadow: `0 0 20px ${s.color}44` }}
                    >
                      <Icon size={20} />
                    </span>
                    <span
                      className={`h-2 w-2 rounded-full transition ${
                        active ? 'bg-cyan-300 shadow-[0_0_12px_rgba(0,240,255,0.9)]' : 'bg-white/15'
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

        <div className="glass mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3.5 text-right">
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-white/[0.05] p-2.5 text-slate-300">
              <Gamepad2 size={18} />
            </span>
            <div>
              <div className="text-[13px] font-extrabold text-white">حالت بازی</div>
              <div className="text-[11px] text-slate-500">
                {coarsePointer
                  ? 'دونفره به کیبورد فیزیکی نیاز دارد'
                  : settings.coOp ? 'دونفره: P1 موس+WASD · P2 جهت‌نما+Enter' : 'تکنفره: WASD + موس'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2" dir="ltr">
            <button
              onClick={onToggleCoop}
              className={`btn-neon rounded-xl px-4 py-2 text-xs font-black ${!settings.coOp ? 'btn-primary' : 'btn-ghost'}`}
            >
              👤 تکی
            </button>
            <button
              onClick={coarsePointer ? undefined : onToggleCoop}
              disabled={coarsePointer}
              title={coarsePointer ? 'needs a keyboard' : undefined}
              className={`btn-neon rounded-xl px-4 py-2 text-xs font-black ${settings.coOp ? 'btn-primary' : 'btn-ghost'} ${coarsePointer ? 'cursor-not-allowed opacity-40' : ''}`}
            >
              👥 دونفره
            </button>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
          <button
            onClick={onPlay}
            className="btn-neon btn-primary btn-hero-pulse group inline-flex items-center gap-2.5 rounded-2xl px-12 py-4 text-[18px] font-black"
          >
            <Play size={22} className="transition-transform group-hover:scale-125" />
            {settings.coOp ? 'شروع نبرد دونفره' : 'شروع نبرد'}
            <span className="rounded-md bg-black/20 px-2 py-0.5 text-[11px] font-bold" dir="ltr">▶</span>
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
                    موج {b.wave} · {b.kills} کیل · {formatTime(b.time)}{b.coOp ? ' · 👥' : ''}
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

        {runs.length > 0 && (
          <div className="glass mt-4 rounded-2xl p-4 text-right">
            <div className="mb-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History size={14} className="text-cyan-200/80" />
                <span className="text-xs font-extrabold text-slate-200">ران‌های اخیر</span>
              </div>
              <span className="eyebrow" dir="ltr">LAST {Math.min(5, runs.length)}</span>
            </div>
            <div className="space-y-1">
              {runs.slice(0, 5).map((r, i) => (
                <div
                  key={`${r.date}-${i}`}
                  className="flex items-center justify-between rounded-xl px-3 py-2 text-[12px] odd:bg-white/[0.025]"
                >
                  <span className="font-display tabular font-bold text-slate-100" dir="ltr">
                    {r.score.toLocaleString('en-US')}
                    {r.victory && <span className="ml-1 text-amber-200">🏆</span>}
                    {r.endless && <InfinityIcon size={11} className="ml-1 inline text-violet-300" />}
                  </span>
                  <span className="tabular text-slate-500">
                    موج {r.wave} · {r.kills} کیل · {formatTime(r.time)}{r.coOp ? ' · 👥' : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="glass mt-4 rounded-2xl p-4 text-right">
          <div className="mb-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen size={14} className="text-violet-200/80" />
              <span className="text-xs font-extrabold text-slate-200">دانشنامه دشمنان</span>
            </div>
            <span className="eyebrow" dir="ltr">CODEX · {codexKinds.length}</span>
          </div>
          <div className="mb-1.5 text-[10px] font-bold text-slate-500">دشمنان — برای جزئیات کلیک کن</div>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {codexRegulars.map((k) => (
              <button
                key={k}
                onClick={() => setSelectedKind(k)}
                title={`${ENEMY_FA[k]} — کلیک برای جزئیات`}
                className="btn-neon group flex items-center gap-2.5 rounded-xl bg-white/[0.02] px-2.5 py-2 text-right transition hover:bg-white/[0.06]"
              >
                <span className="shrink-0 transition-transform group-hover:scale-110">
                  <EnemyIcon kind={k} size={38} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[11.5px] font-extrabold text-slate-200">{ENEMY_FA[k]}</span>
                  <span className="block truncate text-[10px] leading-4 text-slate-500">{ENEMY_LORE[k]}</span>
                </span>
              </button>
            ))}
          </div>
          <div className="mb-1.5 mt-3 text-[10px] font-bold text-slate-500">باس‌ها — هر ۵ موج یه غول</div>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {codexBosses.map((k) => (
              <button
                key={k}
                onClick={() => setSelectedKind(k)}
                title={`${ENEMY_FA[k]} — کلیک برای جزئیات`}
                className="btn-neon group flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-right transition hover:bg-white/[0.06]"
                style={{ backgroundColor: `${ENEMY_COLOR[k]}0d`, border: `1px solid ${ENEMY_COLOR[k]}30` }}
              >
                <span className="shrink-0 transition-transform group-hover:scale-110">
                  <EnemyIcon kind={k} size={42} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[11.5px] font-extrabold text-slate-100">{ENEMY_FA[k]}</span>
                  <span className="block truncate text-[10px] leading-4 text-slate-500">{ENEMY_LORE[k]}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
        {selectedKind && (
          <EnemyDetailModal kind={selectedKind} onClose={() => setSelectedKind(null)} />
        )}

        <div className="mt-4 grid grid-cols-1 gap-2.5 text-right sm:grid-cols-3">
          {[
            { icon: Gamepad2, tint: 'text-cyan-200 bg-cyan-300/10', title: 'حرکت و شلیک', body: 'WASD حرکت · موس aim · شلیک خودکار · هر لول یک ری‌رول' },
            { icon: Skull, tint: 'text-rose-200 bg-rose-400/10', title: 'دشمن و باس', body: `${codexRegulars.length} دشمن · ${codexBosses.length} باس · ${Object.keys(MUTATORS).length} موتاتور — هر ۵ موج یه غول` },
            { icon: Star, tint: 'text-amber-200 bg-amber-300/10', title: 'پیشرفت', body: `${UPGRADE_POOL.length} ارتقا · ${ACHIEVEMENTS.length} اچیومنت · آزمایشگاه دائمی + بی‌پایان ♾️` },
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
