import {
  Heart, Pause, Star, Timer, Volume2, VolumeX, Wind, Zap, Settings,
  Shield, Magnet, Flame, Crown, Gauge, Sparkles, Snowflake, Gem, Ghost,
  Rocket, HeartPulse,
} from 'lucide-react';
import { MUTATORS, type HudSnapshot, type PowerUpKind } from '../game/types';
import { formatScore, formatTime } from '../game/utils';
import Minimap from './Minimap';

interface Props {
  hud: HudSnapshot;
  muted: boolean;
  showFps: boolean;
  gameSpeed: number;
  onPause: () => void;
  onMute: () => void;
  onDash: () => void;
  onOpenSettings: () => void;
}

const POWERUP_META: Record<PowerUpKind, { fa: string; dot: string }> = {
  shield: { fa: 'سپر', dot: 'bg-cyan-300' },
  magnet: { fa: 'مگنت', dot: 'bg-violet-300' },
  nuke: { fa: 'هسته‌ای', dot: 'bg-orange-300' },
  overdrive: { fa: 'اور‌درایو', dot: 'bg-amber-200' },
  heal: { fa: 'درمان', dot: 'bg-emerald-300' },
  frost: { fa: 'یخ', dot: 'bg-sky-200' },
  greed: { fa: 'طمع', dot: 'bg-fuchsia-300' },
  phase: { fa: 'فاز', dot: 'bg-slate-200' },
};

const POWERUP_ICON: Record<PowerUpKind, typeof Shield> = {
  shield: Shield,
  magnet: Magnet,
  nuke: Flame,
  overdrive: Flame,
  heal: Heart,
  frost: Snowflake,
  greed: Gem,
  phase: Ghost,
};

export default function HUD({ hud, muted, showFps, gameSpeed, onPause, onMute, onDash, onOpenSettings }: Props) {
  const hpFrac = Math.max(0, hud.hp / Math.max(1, hud.maxHp));
  const xpFrac = Math.min(1, hud.xp / Math.max(1, hud.xpNext));
  const dashFrac = 1 - hud.dashCd / Math.max(0.01, hud.dashMax);
  const mut = hud.mutator ? MUTATORS[hud.mutator] : null;
  const lowHp = hpFrac < 0.3;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20">
      <div className="h-1 w-full bg-white/[0.06]">
        <div
          className="h-full rounded-r-full bg-gradient-to-l from-emerald-300 to-lime-300 transition-[width] duration-200"
          style={{ width: `${xpFrac * 100}%` }}
        />
      </div>

      {hud.announce && (
        <div key={hud.announce} className="anim-announce chip mx-auto mt-2.5 w-fit border-white/10 bg-black/70 text-[12.5px] text-slate-100 backdrop-blur-md">
          {hud.announce}
        </div>
      )}

      {(mut || showFps || gameSpeed !== 1) && (
        <div className="mx-auto mt-2 flex w-fit items-center gap-1.5">
          {gameSpeed !== 1 && (
            <div className="chip tabular !py-1 font-display !text-[10px]" dir="ltr">
              {gameSpeed > 1 ? 'TURBO' : 'CALM'} · ×{gameSpeed}
            </div>
          )}
          {mut && (
            <div className="chip !border-violet-300/20 !bg-violet-400/10 !py-1 !text-violet-100" dir="ltr">
              <Sparkles size={11} /> {mut.nameEn} · ×{mut.scoreMult}
            </div>
          )}
          {showFps && (
            <div
              className={`chip tabular !py-1 font-display !text-[10px] ${
                hud.fps >= 50 ? '!text-emerald-200 !border-emerald-300/20' : hud.fps >= 30 ? '!text-amber-200 !border-amber-200/20' : '!text-rose-200 !border-rose-300/25'
              }`}
              dir="ltr"
              title={hud.quality === 0 ? 'Cinematic' : hud.quality === 1 ? 'Balanced' : hud.quality === 2 ? 'Performance' : 'Lite'}
            >
              <Gauge size={11} /> {hud.fps} FPS{hud.quality > 0 ? ` · ${hud.quality === 1 ? 'BAL' : hud.quality === 2 ? 'PERF' : 'LITE'}` : ' · MAX'}
            </div>
          )}
        </div>
      )}

      <div className="flex items-start justify-between gap-2 p-3">
        <div className={`glass pointer-events-auto w-60 rounded-2xl p-3.5 ${lowHp ? 'anim-hp-danger !border-rose-400/40' : ''}`}>
          <div className="flex items-center justify-between">
            <span className="tabular inline-flex items-center gap-1.5 text-[12px] font-extrabold text-slate-100" dir="ltr">
              <Heart size={14} className={lowHp ? 'animate-pulse text-rose-400' : 'text-rose-300/80'} fill={lowHp ? 'currentColor' : 'none'} />
              {hud.hp}<span className="font-medium text-slate-500">/{hud.maxHp}</span>
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-300">
              <Star size={12} className="text-amber-200" fill="currentColor" /> لول {hud.level}
            </span>
          </div>
          <div className="bar-shimmer mt-2 h-2.5 overflow-hidden rounded-full bg-white/[0.07] shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]">
            <div
              className={`h-full rounded-full transition-[width] duration-200 ${
                lowHp
                  ? 'bg-gradient-to-l from-rose-400 via-red-400 to-orange-300 shadow-[0_0_16px_rgba(255,60,90,0.7)]'
                  : 'bg-gradient-to-l from-cyan-200 via-sky-400 to-violet-400 shadow-[0_0_12px_rgba(0,240,255,0.5)]'
              }`}
              style={{ width: `${hpFrac * 100}%` }}
            />
          </div>
          <div className="mt-2.5 flex items-center gap-2">
            <Wind size={12} className={dashFrac >= 1 ? 'text-cyan-200' : 'text-slate-600'} />
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
              <div
                className="h-full rounded-full bg-slate-300/80"
                style={{ width: `${Math.min(1, Math.max(0, dashFrac)) * 100}%` }}
              />
            </div>
            <span className="tabular w-12 text-left text-[10px] text-slate-500" dir="ltr">
              {hud.dashCd <= 0 ? 'READY' : hud.dashCd.toFixed(1)}
            </span>
          </div>
          {hud.combo >= 3 && (
            <div className={`mt-2.5 rounded-xl px-2 py-1.5 ${hud.combo >= 10 ? 'bg-gradient-to-l from-amber-300/15 to-orange-500/10 shadow-[0_0_20px_rgba(255,160,30,0.25)]' : ''}`}>
              <div className="mb-1.5 flex items-center justify-between">
                <span className={`font-display tabular text-[13px] font-black ${hud.combo >= 10 ? 'anim-combo neon-gold text-amber-200' : 'text-slate-100'}`} dir="ltr">×{hud.combo}{hud.combo >= 20 ? ' 🔥' : ''}</span>
                {hud.elites > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-200/10 px-2 py-0.5 text-[10px] font-bold text-amber-100/90">
                    <Crown size={10} /> {hud.elites}
                  </span>
                )}
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                <div
                  className="h-full rounded-full bg-gradient-to-l from-amber-200 via-orange-300 to-rose-300 shadow-[0_0_10px_rgba(255,170,40,0.6)]"
                  style={{ width: `${hud.comboT * 100}%` }}
                />
              </div>
            </div>
          )}
          {hud.powerups.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {hud.powerups.map((p) => {
                const Icon = POWERUP_ICON[p.kind];
                const meta = POWERUP_META[p.kind];
                return (
                  <span
                    key={p.kind}
                    className="tabular inline-flex items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.04] px-2 py-1 text-[10px] font-bold text-slate-200"
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                    <Icon size={10} className="text-slate-400" /> {meta.fa}
                    <span className="text-slate-500" dir="ltr">{p.t.toFixed(0)}s</span>
                  </span>
                );
              })}
            </div>
          )}
          {(hud.orbitals > 0 || hud.mods.nova > 0 || hud.mods.seeker > 0 || hud.mods.chain > 0 || hud.mods.phasedive > 0 || hud.mods.secondwind) && (
            <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-bold text-slate-400">
              {hud.orbitals > 0 && <span className="rounded-md bg-white/[0.04] px-1.5 py-0.5">◈ {hud.orbitals} تیغه</span>}
              {hud.mods.nova > 0 && (
                <span className="inline-flex items-center gap-1 rounded-md bg-white/[0.04] px-1.5 py-0.5">
                  <Sparkles size={10} /> نووا {hud.mods.nova}
                </span>
              )}
              {hud.mods.seeker > 0 && (
                <span className="inline-flex items-center gap-1 rounded-md bg-white/[0.04] px-1.5 py-0.5">
                  <Rocket size={10} /> سیکر {hud.mods.seeker}
                </span>
              )}
              {hud.mods.chain > 0 && (
                <span className="inline-flex items-center gap-1 rounded-md bg-cyan-300/10 px-1.5 py-0.5 text-cyan-100 shadow-[0_0_12px_rgba(0,240,255,0.2)]">
                  <Zap size={10} /> زنجیره {hud.mods.chain}
                </span>
              )}
              {hud.mods.phasedive > 0 && (
                <span className="inline-flex items-center gap-1 rounded-md bg-violet-300/10 px-1.5 py-0.5 text-violet-100">
                  <Wind size={10} /> شیرجه {hud.mods.phasedive}
                </span>
              )}
              {hud.mods.secondwind && (
                <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 ${hud.mods.swCd <= 0 ? 'bg-emerald-300/10 text-emerald-200' : 'bg-white/[0.04]'}`}>
                  <HeartPulse size={10} /> {hud.mods.swCd <= 0 ? 'نجات آماده' : `${Math.ceil(hud.mods.swCd)}s`}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col items-center gap-1.5">
          <div className="glass tabular pointer-events-auto hidden items-center gap-4 rounded-2xl px-5 py-2.5 text-center sm:flex" dir="ltr">
            <div>
              <div className="font-display text-[15px] font-bold text-white">{formatScore(hud.score)}</div>
              <div className="eyebrow !text-[9px]">SCORE</div>
            </div>
            <div className="h-7 w-px bg-white/[0.08]" />
            <div>
              <div className="font-display text-[15px] font-bold text-slate-100">W{hud.wave}{hud.endless && <span className="text-violet-300"> ∞</span>}</div>
              <div className="eyebrow !text-[9px]">{hud.kills} KILLS</div>
            </div>
            <div className="h-7 w-px bg-white/[0.08]" />
            <div>
              <div className="font-display inline-flex items-center gap-1.5 text-[15px] font-bold text-white">
                <Timer size={13} className="text-slate-500" /> {formatTime(hud.time)}
              </div>
              <div className="eyebrow !text-[9px]">TIME</div>
            </div>
          </div>
          <div className="hidden w-56 overflow-hidden rounded-full bg-white/[0.07] sm:block">
            <div
              className="h-1 rounded-full bg-gradient-to-l from-cyan-200 to-violet-300 transition-[width] duration-300"
              style={{ width: `${Math.round(hud.waveProgress * 100)}%` }}
            />
          </div>
          {hud.intermission <= 0 && hud.waveLeft > 0 && (
            <div className="tabular hidden text-[10.5px] text-slate-500 sm:block" dir="ltr">
              {hud.waveLeft} LEFT
            </div>
          )}
          {hud.bossHp !== null && hud.bossMax !== null && (
            <div className="glass pointer-events-auto w-64 rounded-2xl border-rose-400/20 px-4 py-2.5 shadow-[0_0_30px_rgba(255,45,90,0.2)] sm:w-80">
              <div className="eyebrow mb-1.5 animate-pulse text-center !text-[10px] !text-rose-200" dir="ltr">
                ⚠ BOSS ⚠
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.08] shadow-[inset_0_1px_3px_rgba(0,0,0,0.6)]">
                <div
                  className="boss-bar-animated h-full rounded-full bg-gradient-to-l from-rose-300 via-red-400 to-orange-400 shadow-[0_0_16px_rgba(255,60,90,0.7)] transition-[width] duration-200"
                  style={{ width: `${(hud.bossHp / Math.max(1, hud.bossMax)) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="pointer-events-auto flex flex-col items-end gap-2">
          <div className="flex items-center gap-1.5">
            <button
              onClick={onMute}
              className="glass rounded-xl p-2.5 text-slate-400 transition hover:text-white"
              aria-label="mute"
            >
              {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <button
              onClick={onPause}
              className="glass rounded-xl p-2.5 text-slate-400 transition hover:text-white"
              aria-label="pause"
            >
              <Pause size={16} />
            </button>
            <button
              onClick={onOpenSettings}
              className="glass rounded-xl p-2.5 text-slate-400 transition hover:text-white"
              aria-label="settings"
            >
              <Settings size={16} />
            </button>
            <button
              onClick={onDash}
              className="btn-neon btn-primary rounded-xl px-4 py-2.5 text-xs font-black sm:hidden"
            >
              دش
            </button>
          </div>
          <div className="hidden sm:block">
            <Minimap dots={hud.dots} px={hud.px} py={hud.py} />
          </div>
        </div>
      </div>

      <div className="tabular mx-3 -mt-1 flex items-center justify-center gap-2.5 text-[11px] text-slate-400 sm:hidden" dir="ltr">
        <span className="font-bold text-white">{formatScore(hud.score)}</span>
        <span className="text-slate-700">·</span>
        <span>W{hud.wave}{hud.endless ? '∞' : ''}</span>
        <span className="text-slate-700">·</span>
        <span>{formatTime(hud.time)}</span>
        {hud.combo >= 5 && <span className="font-bold text-slate-200">×{hud.combo}</span>}
      </div>

      {hud.intermission > 0 && (
        <div className="chip tabular mx-auto mt-1.5 w-fit !text-slate-300" dir="ltr">
          {hud.intermission.toFixed(1)}s
        </div>
      )}
    </div>
  );
}
