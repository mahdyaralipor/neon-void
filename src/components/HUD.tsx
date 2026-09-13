import {
  Heart, Pause, Star, Swords, Timer, Volume2, VolumeX, Wind,
  Shield, Magnet, Flame, Crown, Gauge, Sparkles, Snowflake,
  Rocket, HeartPulse,
} from 'lucide-react';
import { MUTATORS, type HudSnapshot, type PowerUpKind } from '../game/types';
import { formatScore, formatTime } from '../game/utils';
import Minimap from './Minimap';

interface Props {
  hud: HudSnapshot;
  muted: boolean;
  showFps: boolean;
  onPause: () => void;
  onMute: () => void;
  onDash: () => void;
}

const POWERUP_META: Record<PowerUpKind, { fa: string; color: string }> = {
  shield: { fa: 'سپر', color: 'text-cyan-300' },
  magnet: { fa: 'مگنت', color: 'text-violet-300' },
  nuke: { fa: 'هسته‌ای', color: 'text-orange-300' },
  overdrive: { fa: 'اور‌درایو', color: 'text-yellow-300' },
  heal: { fa: 'درمان', color: 'text-emerald-300' },
  frost: { fa: 'یخ', color: 'text-sky-200' },
};

const POWERUP_ICON: Record<PowerUpKind, typeof Shield> = {
  shield: Shield,
  magnet: Magnet,
  nuke: Flame,
  overdrive: Flame,
  heal: Heart,
  frost: Snowflake,
};

export default function HUD({ hud, muted, showFps, onPause, onMute, onDash }: Props) {
  const hpFrac = Math.max(0, hud.hp / Math.max(1, hud.maxHp));
  const xpFrac = Math.min(1, hud.xp / Math.max(1, hud.xpNext));
  const dashFrac = 1 - hud.dashCd / Math.max(0.01, hud.dashMax);
  const mut = hud.mutator ? MUTATORS[hud.mutator] : null;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20">
      {/* XP bar */}
      <div className="h-1.5 w-full bg-white/5">
        <div
          className="h-full bg-gradient-to-l from-lime-300 to-emerald-400 shadow-[0_0_12px_rgba(163,255,18,0.8)] transition-[width] duration-200"
          style={{ width: `${xpFrac * 100}%` }}
        />
      </div>

      {/* announcement */}
      {hud.announce && (
        <div key={hud.announce} className="anim-announce mx-auto mt-2 w-fit rounded-full border border-yellow-300/40 bg-black/60 px-5 py-1.5 text-sm font-black text-yellow-200 shadow-[0_0_24px_rgba(255,211,25,0.35)] backdrop-blur-sm">
          {hud.announce}
        </div>
      )}

      {/* mutator + fps badges */}
      {(mut || showFps) && (
        <div className="mx-auto mt-1.5 flex w-fit items-center gap-2">
          {mut && (
            <div className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/40 bg-violet-500/15 px-3 py-0.5 text-[11px] font-black text-violet-200 backdrop-blur-sm" dir="ltr">
              <Sparkles size={12} /> {mut.nameEn} · ×{mut.scoreMult}
            </div>
          )}
          {showFps && (
            <div
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 font-display text-[11px] font-bold backdrop-blur-sm ${
                hud.fps >= 50
                  ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300'
                  : hud.fps >= 30
                    ? 'border-yellow-400/30 bg-yellow-500/10 text-yellow-300'
                    : 'border-red-400/40 bg-red-500/10 text-red-300'
              }`}
              dir="ltr"
            >
              <Gauge size={12} /> {hud.fps} FPS{hud.quality > 0 ? ` · Q${hud.quality}` : ''}
            </div>
          )}
        </div>
      )}

      <div className="flex items-start justify-between gap-2 p-3">
        {/* right: status (rtl first) */}
        <div className="glass pointer-events-auto w-64 rounded-2xl p-3">
          <div className="flex items-center justify-between text-[11px] text-slate-300">
            <span className="inline-flex items-center gap-1 font-bold text-rose-300">
              <Heart size={13} /> {hud.hp} / {hud.maxHp}
            </span>
            <span className="inline-flex items-center gap-1 text-lime-300">
              <Star size={13} /> لول {hud.level}
            </span>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full rounded-full transition-[width] duration-150 ${
                hpFrac < 0.3
                  ? 'bg-gradient-to-l from-red-500 to-rose-400'
                  : 'bg-gradient-to-l from-cyan-400 to-sky-500'
              }`}
              style={{ width: `${hpFrac * 100}%` }}
            />
          </div>
          {/* dash */}
          <div className="mt-2 flex items-center gap-2">
            <Wind size={13} className={dashFrac >= 1 ? 'text-cyan-300' : 'text-slate-500'} />
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-cyan-300/80"
                style={{ width: `${Math.min(1, Math.max(0, dashFrac)) * 100}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-400">
              {hud.dashCd <= 0 ? 'دش آماده' : hud.dashCd.toFixed(1)}
            </span>
          </div>
          {/* combo bar */}
          {hud.combo >= 3 && (
            <div className="mt-2">
              <div className="mb-1 flex items-center justify-between text-[10px]">
                <span className="font-black text-orange-300" dir="ltr">x{hud.combo} COMBO</span>
                {hud.elites > 0 && (
                  <span className="inline-flex items-center gap-1 font-bold text-yellow-300">
                    <Crown size={11} /> {hud.elites} الیت
                  </span>
                )}
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-l from-orange-400 to-yellow-300"
                  style={{ width: `${hud.comboT * 100}%` }}
                />
              </div>
            </div>
          )}
          {/* active powerups */}
          {hud.powerups.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {hud.powerups.map((p) => {
                const Icon = POWERUP_ICON[p.kind];
                const meta = POWERUP_META[p.kind];
                return (
                  <span
                    key={p.kind}
                    className={`inline-flex items-center gap-1 rounded-lg bg-white/8 px-2 py-0.5 text-[10px] font-bold ${meta.color}`}
                  >
                    <Icon size={11} /> {meta.fa} {p.t.toFixed(0)}s
                  </span>
                );
              })}
            </div>
          )}
          {hud.orbitals > 0 && (
            <div className="mt-1.5 text-[10px] font-bold text-yellow-300">
              ◈ {hud.orbitals} تیغه مداری فعال
            </div>
          )}
          {/* weapon mods (nova / seeker / second-wind) */}
          {(hud.mods.nova > 0 || hud.mods.seeker > 0 || hud.mods.secondwind) && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {hud.mods.nova > 0 && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-white/8 px-2 py-0.5 text-[10px] font-bold text-orange-300">
                  <Sparkles size={11} /> نووا ×{hud.mods.nova}
                </span>
              )}
              {hud.mods.seeker > 0 && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-white/8 px-2 py-0.5 text-[10px] font-bold text-orange-300">
                  <Rocket size={11} /> سیکر ×{hud.mods.seeker}
                </span>
              )}
              {hud.mods.secondwind && (
                <span
                  className={`inline-flex items-center gap-1 rounded-lg bg-white/8 px-2 py-0.5 text-[10px] font-bold ${
                    hud.mods.swCd <= 0 ? 'text-emerald-300' : 'text-slate-500'
                  }`}
                >
                  <HeartPulse size={11} />{' '}
                  {hud.mods.swCd <= 0 ? 'فرصت دوباره آماده' : `فرصت دوباره ${Math.ceil(hud.mods.swCd)}s`}
                </span>
              )}
            </div>
          )}
        </div>

        {/* center stats */}
        <div className="flex flex-col items-center gap-2">
          <div className="glass pointer-events-auto hidden items-center gap-4 rounded-2xl px-5 py-2.5 text-center sm:flex" dir="ltr">
            <div>
              <div className="font-display text-lg font-black text-white">{formatScore(hud.score)}</div>
              <div className="text-[10px] text-slate-400">SCORE</div>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div>
              <div className="font-display text-lg font-black text-cyan-300">W{hud.wave}</div>
              <div className="text-[10px] text-slate-400">
                {Math.round(hud.waveProgress * 100)}% · <Swords size={10} className="inline" /> {hud.kills}
              </div>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div>
              <div className="font-display inline-flex items-center gap-1 text-lg font-black text-white">
                <Timer size={15} className="text-slate-400" /> {formatTime(hud.time)}
              </div>
              <div className="text-[10px] text-slate-400">TIME</div>
            </div>
          </div>
          {/* boss bar */}
          {hud.bossHp !== null && hud.bossMax !== null && (
            <div className="glass pointer-events-auto w-72 rounded-2xl px-4 py-2 sm:w-96">
              <div className="mb-1 text-center text-[10px] font-black tracking-[0.3em] text-red-400" dir="ltr">
                ◆ BOSS ◆
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-l from-red-600 via-rose-500 to-orange-400 transition-[width] duration-200"
                  style={{ width: `${(hud.bossHp / Math.max(1, hud.bossMax)) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* left: minimap + buttons */}
        <div className="pointer-events-auto flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={onMute}
              className="glass rounded-xl p-2.5 text-slate-200 hover:text-white"
              aria-label="mute"
            >
              {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
            </button>
            <button
              onClick={onPause}
              className="glass rounded-xl p-2.5 text-slate-200 hover:text-white"
              aria-label="pause"
            >
              <Pause size={17} />
            </button>
            <button
              onClick={onDash}
              className="rounded-xl bg-cyan-400 px-4 py-2.5 text-xs font-black text-slate-950 shadow-[0_0_20px_rgba(0,240,255,0.5)] sm:hidden"
            >
              دش
            </button>
          </div>
          <div className="hidden sm:block">
            <Minimap dots={hud.dots} px={hud.px} py={hud.py} />
          </div>
        </div>
      </div>

      {/* mobile compact stats */}
      <div className="mx-3 -mt-1 flex items-center justify-center gap-3 text-[11px] text-slate-300 sm:hidden" dir="ltr">
        <span className="font-display font-bold text-white">{formatScore(hud.score)}</span>
        <span>·</span>
        <span className="font-bold text-cyan-300">W{hud.wave}</span>
        <span>·</span>
        <span>{formatTime(hud.time)}</span>
        {hud.combo >= 5 && <span className="font-bold text-orange-300">x{hud.combo}</span>}
      </div>

      {hud.intermission > 0 && (
        <div className="mx-auto mt-1 w-fit rounded-full border border-yellow-300/30 bg-yellow-400/10 px-4 py-1 text-[11px] font-bold text-yellow-200">
          استراحت بین موج — {hud.intermission.toFixed(1)} ثانیه + درمان
        </div>
      )}
    </div>
  );
}
