import { Home, RotateCcw, Swords, Timer, Trophy, Layers, Flame, Crown, Medal } from 'lucide-react';
import type { GameResult, Grade } from '../game/types';
import type { BoardEntry } from '../game/storage';
import { formatScore, formatTime } from '../game/utils';

interface Props {
  result: GameResult;
  best: number;
  board: BoardEntry[];
  onRetry: () => void;
  onMenu: () => void;
}

const GRADE_STYLE: Record<Grade, { bg: string; fa: string }> = {
  S: { bg: 'from-yellow-300 to-amber-500 shadow-[0_0_50px_rgba(255,211,25,0.6)]', fa: 'افسانه‌ای!' },
  A: { bg: 'from-violet-400 to-purple-600 shadow-[0_0_40px_rgba(177,75,255,0.5)]', fa: 'فوق‌العاده!' },
  B: { bg: 'from-cyan-400 to-sky-600 shadow-[0_0_40px_rgba(0,240,255,0.4)]', fa: 'خوب!' },
  C: { bg: 'from-emerald-400 to-green-600 shadow-[0_0_30px_rgba(61,255,142,0.35)]', fa: 'قابل قبول' },
  D: { bg: 'from-slate-400 to-slate-600 shadow-[0_0_20px_rgba(148,163,184,0.3)]', fa: 'تلاش بیشتر!' },
};

export default function GameOver({ result, best, board, onRetry, onMenu }: Props) {
  const g = GRADE_STYLE[result.grade];
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm">
      <div className="glass anim-rise my-auto w-full max-w-md rounded-3xl p-7 text-center">
        <div className="flex items-start justify-center gap-3">
          <div className={`inline-flex rounded-2xl bg-gradient-to-br p-4 text-slate-950 ${g.bg}`}>
            <span className="font-display text-4xl font-black" dir="ltr">{result.grade}</span>
          </div>
          <div className="pt-1 text-right">
            <h2 className="text-2xl font-black text-white">تو در خلأ حل شدی</h2>
            <p className="text-xs font-bold text-slate-400">{g.fa}</p>
          </div>
        </div>

        {result.isBest && (
          <div className="mx-auto mt-4 inline-flex items-center gap-2 rounded-full border border-yellow-300/40 bg-yellow-400/15 px-4 py-1.5 text-sm font-bold text-yellow-200">
            <Trophy size={15} /> رکورد جدید!
          </div>
        )}

        <div className="font-display mt-4 text-5xl font-black text-white" dir="ltr">
          {formatScore(result.score)}
        </div>
        <div className="mt-1 text-[11px] text-slate-400">امتیاز نهایی · بهترین: {best.toLocaleString('en-US')}</div>

        <div className="mt-5 grid grid-cols-3 gap-2 text-right">
          <Stat icon={<Swords size={14} />} label="کیل‌ها" value={String(result.kills)} />
          <Stat icon={<Crown size={14} />} label="الیت" value={String(result.elites)} />
          <Stat icon={<Layers size={14} />} label="موج" value={String(result.wave)} />
          <Stat icon={<Timer size={14} />} label="زمان" value={formatTime(result.time)} />
          <Stat icon={<Flame size={14} />} label="کمبو" value={`x${result.maxCombo}`} />
          <Stat icon={<Medal size={14} />} label="لول" value={String(result.level)} />
        </div>

        {board.length > 0 && (
          <div className="mt-4 rounded-xl bg-white/[0.03] p-3 text-right">
            <div className="mb-1.5 text-[11px] font-black text-yellow-200">تابلوی افتخار</div>
            {board.slice(0, 3).map((b, i) => (
              <div key={`${b.date}-${i}`} className="flex justify-between py-0.5 text-[11px] text-slate-400">
                <span className="font-display font-bold text-slate-200" dir="ltr">
                  #{i + 1} {b.score.toLocaleString('en-US')}
                </span>
                <span>موج {b.wave} · {formatTime(b.time)}</span>
              </div>
            ))}
          </div>
        )}

        {result.upgradesTaken.length > 0 && (
          <p className="mt-3 text-[11px] leading-5 text-slate-500">
            بیلد: {result.upgradesTaken.slice(0, 8).join(' · ')}
          </p>
        )}

        <div className="mt-5 flex gap-2">
          <button
            onClick={onRetry}
            className="btn-neon flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-cyan-400 to-sky-500 px-5 py-3 text-sm font-black text-slate-950"
          >
            <RotateCcw size={17} /> تلاش دوباره
          </button>
          <button
            onClick={onMenu}
            className="btn-neon inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-bold text-white"
          >
            <Home size={17} /> منو
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/[0.04] px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
        {icon} {label}
      </div>
      <div className="font-display mt-0.5 text-base font-bold text-white" dir="ltr">
        {value}
      </div>
    </div>
  );
}
