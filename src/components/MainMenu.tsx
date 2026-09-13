import {
  Play, Settings, Trophy, Volume2, VolumeX, Gamepad2, Zap, Shield,
  Star, Rocket, Ghost, Anchor, Medal, Swords, Timer, Layers,
  Droplet, Sparkles, Crown, Skull, Orbit, Award, Crosshair,
} from 'lucide-react';
import { SHIPS, type ShipId } from '../game/types';
import type { BoardEntry, SavedSettings, Totals } from '../game/storage';
import { ACHIEVEMENTS, getUnlockedAchievements } from '../game/achievements';
import { formatTime } from '../game/utils';
import { useMemo } from 'react';

const ACH_ICON: Record<string, typeof Zap> = {
  droplet: Droplet,
  combo: Sparkles,
  crown: Crown,
  skull: Skull,
  shield: Shield,
  medal: Medal,
  nuke: Crosshair,
  orbit: Orbit,
  timer: Timer,
};

interface Props {
  best: number;
  board: BoardEntry[];
  totals: Totals;
  settings: SavedSettings;
  onPlay: () => void;
  onOpenSettings: () => void;
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
};

export default function MainMenu({ best, board, totals, settings, onPlay, onOpenSettings, onToggleMute, onSelectShip }: Props) {
  const unlocked = useMemo(() => getUnlockedAchievements(), []);
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      {/* animated bg */}
      <div className="menu-grid-bg anim-grid absolute inset-0" />
      <div className="anim-blob-a absolute -top-32 left-1/2 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-cyan-500/15 blur-[110px]" />
      <div className="anim-blob-b absolute bottom-0 right-0 h-64 w-96 rounded-full bg-pink-600/15 blur-[110px]" />
      <div className="anim-blob-c absolute top-1/3 left-0 h-56 w-72 rounded-full bg-violet-600/15 blur-[100px]" />

      <div className="relative w-full max-w-3xl text-center">
        <div className="anim-rise inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-1 text-xs text-cyan-200">
          <Zap size={14} />
          نسخه ۲ — الیت‌ها · پاورآپ‌ها · تیغه‌های مداری · ۹ دشمن
        </div>

        <h1
          className="font-display anim-title mt-5 text-6xl font-black tracking-wider text-white neon-text sm:text-7xl"
          dir="ltr"
        >
          NEON VOID
        </h1>
        <p className="mt-3 text-lg font-bold text-pink-400 neon-pink">آرنا سروایور نئونی</p>

        {/* stats strip */}
        {(best > 0 || totals.runs > 0) && (
          <div className="mx-auto mt-5 flex w-fit flex-wrap items-center justify-center gap-2 text-[12px]">
            {best > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-yellow-400/30 bg-yellow-400/10 px-3 py-1.5 font-bold text-yellow-200">
                <Trophy size={14} />
                رکورد: <span className="font-display" dir="ltr">{best.toLocaleString('en-US')}</span>
              </span>
            )}
            {totals.runs > 0 && (
              <>
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-slate-300">
                  <Swords size={14} /> {totals.kills.toLocaleString('en-US')} کیل کل
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-slate-300">
                  <Layers size={14} /> موج {totals.bestWave}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-slate-300">
                  <Timer size={14} /> {formatTime(totals.time)}
                </span>
              </>
            )}
          </div>
        )}

        {/* ship select */}
        <div className="glass mt-6 rounded-2xl p-4 text-right">
          <div className="mb-3 text-center text-xs font-black tracking-widest text-slate-400" dir="ltr">
            ◆ SELECT YOUR SHIP ◆
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {SHIPS.map((s) => {
              const Icon = SHIP_ICON[s.id];
              const active = settings.ship === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => onSelectShip(s.id)}
                  className={`rounded-xl border p-3 text-right transition ${
                    active
                      ? 'border-cyan-300/60 bg-cyan-400/10 shadow-[0_0_24px_rgba(0,240,255,0.2)]'
                      : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.07]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span style={{ color: s.color }}>
                      <Icon size={22} />
                    </span>
                    {active && (
                      <span className="rounded-md bg-cyan-400/20 px-2 py-0.5 text-[10px] font-black text-cyan-200">
                        انتخاب شده
                      </span>
                    )}
                  </div>
                  <div className="mt-2 font-black text-white">{s.nameFa}</div>
                  <div className="font-display text-[10px] tracking-widest text-slate-500" dir="ltr">
                    {s.nameEn}
                  </div>
                  <div className="mt-1 text-[11px] leading-5 text-slate-400">{s.descFa}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={onPlay}
            className="btn-neon group inline-flex items-center gap-2 rounded-2xl bg-gradient-to-l from-cyan-400 to-sky-500 px-10 py-4 text-lg font-black text-slate-950 shadow-[0_0_36px_rgba(0,240,255,0.45)]"
          >
            <Play size={22} className="transition-transform group-hover:scale-125" />
            شروع نبرد
          </button>
          <button
            onClick={onOpenSettings}
            className="btn-neon inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-6 py-4 text-sm font-bold text-white hover:bg-white/10"
          >
            <Settings size={18} />
            تنظیمات
            <span className="rounded-md bg-white/10 px-2 py-0.5 text-[11px] text-slate-300">
              {DIFF_FA[settings.difficulty]}
            </span>
          </button>
          <button
            onClick={onToggleMute}
            className="btn-neon inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-5 py-4 text-sm font-bold text-white hover:bg-white/10"
            aria-label="mute"
          >
            {settings.muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        </div>

        {/* leaderboard */}
        {board.length > 0 && (
          <div className="glass mt-5 rounded-2xl p-4 text-right">
            <div className="mb-2 flex items-center gap-2 text-yellow-200">
              <Medal size={15} />
              <span className="text-xs font-black">تابلوی افتخار (۵ رکورد برتر)</span>
            </div>
            <div className="space-y-1.5">
              {board.map((b, i) => (
                <div
                  key={`${b.date}-${i}`}
                  className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-1.5 text-[12px]"
                >
                  <span className="font-display font-black text-slate-200" dir="ltr">
                    <span className={i === 0 ? 'text-yellow-300' : 'text-slate-500'}>#{i + 1}</span>{' '}
                    {b.score.toLocaleString('en-US')}
                  </span>
                  <span className="text-slate-400">
                    موج {b.wave} · {b.kills} کیل · {formatTime(b.time)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* achievements */}
        <div className="glass mt-5 rounded-2xl p-4 text-right">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-200">
              <Award size={15} />
              <span className="text-xs font-black">اچیومنت‌ها</span>
            </div>
            <span className="font-display text-[11px] font-bold text-slate-400" dir="ltr">
              {unlocked.size}/{ACHIEVEMENTS.length}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-9">
            {ACHIEVEMENTS.map((a) => {
              const Icon = ACH_ICON[a.icon] ?? Zap;
              const has = unlocked.has(a.id);
              return (
                <div
                  key={a.id}
                  title={`${a.nameFa} — ${a.descFa}`}
                  className={`flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-center ${
                    has ? 'bg-amber-400/10 text-amber-200' : 'bg-white/[0.03] text-slate-600'
                  }`}
                >
                  <Icon size={16} />
                  <span className="text-[9px] font-bold leading-3">{a.nameFa}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="glass mt-5 grid grid-cols-1 gap-3 rounded-2xl p-5 text-right sm:grid-cols-3">
          <div className="rounded-xl bg-white/[0.03] p-3">
            <div className="flex items-center gap-2 text-cyan-300">
              <Gamepad2 size={16} />
              <span className="text-xs font-bold">حرکت و شلیک</span>
            </div>
            <p className="mt-2 text-[12px] leading-6 text-slate-300">
              <kbd className="key">W</kbd> <kbd className="key">A</kbd> <kbd className="key">S</kbd>{' '}
              <kbd className="key">D</kbd> حرکت — موس aim — شلیک خودکار
            </p>
          </div>
          <div className="rounded-xl bg-white/[0.03] p-3">
            <div className="flex items-center gap-2 text-pink-300">
              <Shield size={16} />
              <span className="text-xs font-bold">دش و پاورآپ</span>
            </div>
            <p className="mt-2 text-[12px] leading-6 text-slate-300">
              <kbd className="key">Shift</kbd> دش با گوست — سپر، مگنت، نیوک و اور‌درایو جمع کن
            </p>
          </div>
          <div className="rounded-xl bg-white/[0.03] p-3">
            <div className="flex items-center gap-2 text-lime-300">
              <Star size={16} />
              <span className="text-xs font-bold">پیشرفت</span>
            </div>
            <p className="mt-2 text-[12px] leading-6 text-slate-300">
              الیت‌های طلایی = ۵× تجربه — باس هر ۵ موج — ۲۱ ارتقا
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
