import { useState } from 'react';
import { Home, RotateCcw, Trophy, Share2, Check, Infinity as InfinityIcon, History } from 'lucide-react';
import type { GameResult, Grade } from '../game/types';
import type { BoardEntry } from '../game/storage';
import { formatScore, formatTime } from '../game/utils';
import { UPGRADE_MAP } from '../game/upgrades';

interface Props {
  result: GameResult;
  best: number;
  board: BoardEntry[];
  onRetry: () => void;
  onMenu: () => void;
  onEndless?: () => void;
  checkpointWave?: number | null;
  onCheckpoint?: () => void;
}

const GRADE_TILE: Record<Grade, string> = {
  S: 'from-amber-200 via-yellow-300 to-orange-400 text-amber-950 shadow-[0_0_50px_rgba(255,211,25,0.5)]',
  A: 'from-violet-300 via-purple-400 to-fuchsia-500 text-purple-950 shadow-[0_0_40px_rgba(177,75,255,0.5)]',
  B: 'from-cyan-200 via-sky-300 to-blue-400 text-sky-950 shadow-[0_0_36px_rgba(0,240,255,0.45)]',
  C: 'from-emerald-200 to-green-300 text-emerald-950',
  D: 'from-slate-300 to-slate-400 text-slate-900',
};

const GRADE_FA: Record<Grade, string> = {
  S: 'افسانه‌ای',
  A: 'فوق‌العاده',
  B: 'تمیز بازی کردی',
  C: 'قابل قبول',
  D: 'دفعه بعد بهتر',
};

export default function GameOver({ result, best, board, onRetry, onMenu, onEndless, checkpointWave, onCheckpoint }: Props) {
  const victory = result.victory;
  const canEndless = victory && !result.endless && onEndless;
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = 'https://mahdyaralipor.github.io/neon-void/';
    const txt = victory
      ? `NEON VOID 🏆 پیروزی در موج ۲۰ — ${formatScore(result.score)} امتیاز · ${result.kills} کیل · ${formatTime(result.time)}\n${url}`
      : `NEON VOID${result.endless ? ' ♾️' : ''} — ${formatScore(result.score)} امتیاز · موج ${result.wave} · ${result.kills} کیل · گرید ${result.grade} · ${formatTime(result.time)}\n${url}`;
    try {
      await navigator.clipboard.writeText(txt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };
  const buildNames = result.upgradesTaken.slice(0, 8).map((id) => UPGRADE_MAP[id]?.nameFa ?? id);
  const stats: [string, string][] = [
    ['کیل', String(result.kills)],
    ['الیت', String(result.elites)],
    ['موج', String(result.wave)],
    ['زمان', formatTime(result.time)],
    ['کمبو', `×${result.maxCombo}`],
    ['لول', String(result.level)],
  ];
  return (
    <div className="scanlines absolute inset-0 z-30 flex items-center justify-center overflow-y-auto overflow-hidden bg-black/75 p-4 backdrop-blur-lg">
      {victory && (
        <>
          <div className="victory-rays pointer-events-none absolute inset-0" />
          {Array.from({ length: 28 }).map((_, i) => (
            <span
              key={i}
              className="victory-confetti"
              style={{
                left: `${(i * 37) % 100}%`,
                background: ['#00f0ff', '#ff2d78', '#ffd319', '#a3ff12', '#b14bff'][i % 5],
                animationDuration: `${2.2 + (i % 5) * 0.5}s`,
                animationDelay: `${(i % 7) * 0.3}s`,
                boxShadow: '0 0 8px currentColor',
              }}
            />
          ))}
        </>
      )}
      <div className={`glass anim-rise relative my-auto w-full max-w-md rounded-3xl p-6 text-center sm:p-7 ${victory ? '!border-amber-200/30 shadow-[0_0_60px_rgba(255,211,25,0.25)]' : ''}`}>
        <div className="flex items-center justify-center gap-4">
          <div className={`anim-grade inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br ${GRADE_TILE[result.grade]}`}>
            <span className="font-display text-4xl font-black" dir="ltr">{result.grade}</span>
          </div>
          <div className="text-right">
            <div className="eyebrow" dir="ltr">{victory ? 'VICTORY' : 'RUN OVER'}</div>
            <h2 className="mt-1 text-xl font-extrabold tracking-tight text-white">
              {victory ? 'خلأ رام شد!' : 'سفرت تمام شد'}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {victory ? 'پیروزی در موج ۲۰ · ‎+۱۰ ◇' : result.deathBy ? `قاتل: ${result.deathBy}` : GRADE_FA[result.grade]}
            </p>
          </div>
        </div>

        {result.isBest && (
          <div className="chip mx-auto mt-4 w-fit !border-amber-200/25 !bg-amber-200/[0.08] !text-amber-100">
            <Trophy size={13} /> رکورد جدید
          </div>
        )}

        <div className="font-display tabular anim-score-pop mt-4 text-[48px] font-black leading-none tracking-tight text-white neon-text" dir="ltr">
          {formatScore(result.score)}
        </div>
        <div className="tabular mt-1.5 text-[11px] text-slate-500" dir="ltr">
          BEST {best.toLocaleString('en-US')} · +{result.shards} ◇ · {result.powerups} POWERUPS
        </div>

        <div className="tabular mt-5 grid grid-cols-3 gap-1.5">
          {stats.map(([label, value]) => (
            <div key={label} className="rounded-xl bg-white/[0.035] px-2 py-2.5">
              <div className="font-display text-[14px] font-bold text-white" dir="ltr">{value}</div>
              <div className="mt-0.5 text-[10.5px] text-slate-500">{label}</div>
            </div>
          ))}
        </div>

        {board.length > 0 && (
          <div className="mt-2.5 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 text-right">
            <div className="eyebrow mb-1.5" dir="ltr">TOP RUNS</div>
            {board.slice(0, 3).map((b, i) => (
              <div key={`${b.date}-${i}`} className="tabular flex justify-between py-1 text-[11.5px]">
                <span className="font-display font-bold text-slate-200" dir="ltr">
                  <span className={i === 0 ? 'text-amber-200/90' : 'text-slate-600'}>#{i + 1}</span>{' '}
                  {b.score.toLocaleString('en-US')}
                </span>
                <span className="text-slate-500">موج {b.wave} · {formatTime(b.time)}</span>
              </div>
            ))}
          </div>
        )}

        {buildNames.length > 0 && (
          <div className="mt-2.5 flex flex-wrap justify-center gap-1.5">
            {buildNames.map((n) => (
              <span key={n} className="rounded-lg bg-white/[0.05] px-2 py-1 text-[10.5px] font-bold text-slate-400">
                {n}
              </span>
            ))}
          </div>
        )}

        <div className="mt-5 flex flex-col gap-2">
          {canEndless && (
            <button
              onClick={onEndless}
              className="btn-neon btn-primary btn-hero-pulse inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-[15px] font-black"
            >
              <InfinityIcon size={18} /> ادامه بی‌پایان ♾️ ×۱.۵ امتیاز
            </button>
          )}
          {checkpointWave && onCheckpoint && (
            <button
              onClick={onCheckpoint}
              className="btn-neon btn-ghost inline-flex w-full items-center justify-center gap-2 rounded-2xl border-cyan-200/25 px-5 py-3 text-sm font-black text-cyan-100"
            >
              <History size={16} /> ادامه از موج {checkpointWave} — بیلدت محفوظه
            </button>
          )}
          <div className="flex gap-2">
          <button
            onClick={onRetry}
            className="btn-neon btn-primary flex-1 inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-black"
          >
            <RotateCcw size={16} /> تلاش دوباره
          </button>
          <button
            onClick={share}
            className="btn-neon btn-ghost inline-flex items-center justify-center rounded-2xl px-4 py-3"
            aria-label="share"
          >
            {copied ? <Check size={16} className="text-emerald-300" /> : <Share2 size={16} className="text-slate-400" />}
          </button>
          <button
            onClick={onMenu}
            className="btn-neon btn-ghost inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-[13px] font-bold"
          >
            <Home size={15} className="text-slate-400" /> منو
          </button>
          </div>
          {result.endless && (
            <div className="chip mx-auto w-fit !border-violet-300/25 !bg-violet-400/10 !text-violet-100" dir="ltr">
              ♾️ ENDLESS · W{result.wave}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
