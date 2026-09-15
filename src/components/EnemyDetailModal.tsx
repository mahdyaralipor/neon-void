import { useEffect, useMemo, useRef } from 'react';
import { X, Swords, Heart, Gauge, Star, MapPin, Flame } from 'lucide-react';
import type { EnemyKind } from '../game/types';
import { ENEMY_COLOR, ENEMY_FA, ENEMY_LORE, ENEMY_ROLE, ENEMY_TIP, ENEMY_UNLOCK, createEnemy, isBossKind } from '../game/enemies';
import { drawEnemyArt } from '../game/enemyArt';

interface Props {
  kind: EnemyKind;
  onClose: () => void;
}

const THREAT: Record<EnemyKind, number> = {
  mini: 1, chaser: 1,
  weaver: 2, dasher: 2, shooter: 2, splitter: 2, lancer: 2, stinger: 2, mender: 2,
  bomber: 3, sniper: 3, tank: 3, hive: 3, tesla: 3, mortar: 3, mirage: 3,
  boss: 4, juggernaut: 4, tempest: 4,
  voidborn: 5,
};

const CALLOUT: Partial<Record<EnemyKind, string>> = {
  mender: '🎯 اولویت اول میدان',
  mortar: '⚠ منطقه خطر متحرک',
  sniper: '☠ قاتل خاموش',
  hive: '🐝 قلب گله',
  mirage: '👁 چشم ازش برندار',
  voidborn: '🕳️ فینال موج ۲۰',
};

interface Sample {
  hp: number;
  dmg: number;
  speed: number;
  xp: number;
  score: number;
}

function sample(kind: EnemyKind): Sample {
  const wave = ENEMY_UNLOCK[kind];
  for (let i = 0; i < 8; i++) {
    const e = createEnemy(kind, 0, 0, { id: 0, wave, time: 0, difficulty: 'normal', mutator: null, endless: false });
    if (!e.elite) {
      return { hp: e.maxHp, dmg: Math.round(e.dmg), speed: Math.round(e.speed), xp: e.xp, score: e.score };
    }
  }
  const e = createEnemy('chaser', 0, 0, { id: 0, wave: 1, time: 0, difficulty: 'normal', mutator: null, endless: false });
  return { hp: e.maxHp, dmg: Math.round(e.dmg), speed: Math.round(e.speed), xp: e.xp, score: e.score };
}

/** animated hero: the living hull over a drifting starfield */
function Hero({ kind, color }: { kind: EnemyKind; color: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const W = 320;
    const H = 168;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    const stars = Array.from({ length: 46 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      s: Math.random() * 1.6 + 0.4,
      v: Math.random() * 14 + 4,
    }));
    let raf = 0;
    const t0 = performance.now();
    const boss = isBossKind(kind);
    const frame = (now: number) => {
      const t = (now - t0) / 1000;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      // starfield drift
      ctx.fillStyle = 'rgba(200,220,255,0.5)';
      for (const st of stars) {
        const y = (st.y + t * st.v) % H;
        ctx.globalAlpha = 0.25 + (st.s / 2) * 0.4;
        ctx.fillRect(st.x, y, st.s, st.s);
      }
      ctx.globalAlpha = 1;
      // breathing aura
      const breathe = 1 + Math.sin(t * 2.2) * 0.08;
      const r = (boss ? 44 : 30) * breathe;
      drawEnemyArt(ctx, kind, W / 2, H / 2, r, t, { glow: true, spin: false });
      // boss orbit spark
      if (boss) {
        const a = t * 1.4;
        const ox = W / 2 + Math.cos(a) * (r + 22);
        const oy = H / 2 + Math.sin(a) * (r + 22);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ox, oy, 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(ox, oy, 4.5, 0, Math.PI * 2);
        ctx.globalAlpha = 0.35;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [kind, color]);

  return <canvas ref={ref} className="h-[168px] w-full" style={{ width: '100%', height: 168 }} />;
}

export default function EnemyDetailModal({ kind, onClose }: Props) {
  const color = ENEMY_COLOR[kind];
  const boss = isBossKind(kind);
  const stats = useMemo(() => sample(kind), [kind]);
  const peers = useMemo(() => {
    // normalize bars within the class so minis stay visible next to bosses
    const kinds = (Object.keys(ENEMY_COLOR) as EnemyKind[]).filter((k) => isBossKind(k) === boss);
    let hp = 1;
    let dmg = 1;
    let speed = 1;
    for (const k of kinds) {
      const s = sample(k);
      hp = Math.max(hp, s.hp);
      dmg = Math.max(dmg, s.dmg);
      speed = Math.max(speed, s.speed);
    }
    return { hp, dmg, speed };
  }, [boss]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const bars = [
    { label: 'جان', value: stats.hp, max: peers.hp, icon: Heart, fmt: (v: number) => v.toLocaleString('en-US') },
    { label: 'دمیج', value: stats.dmg, max: peers.dmg, icon: Swords, fmt: (v: number) => `${v}` },
    { label: 'سرعت', value: stats.speed, max: peers.speed, icon: Gauge, fmt: (v: number) => `${v}` },
  ];
  const threat = THREAT[kind];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="anim-rise my-auto w-full max-w-md overflow-hidden rounded-3xl border bg-[#0a0d20]/95"
        style={{ borderColor: `${color}55`, boxShadow: `0 0 60px ${color}33, 0 24px 60px rgba(0,0,0,0.6)` }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* hero */}
        <div className="relative" style={{ background: `radial-gradient(ellipse at 50% 120%, ${color}26, transparent 70%)` }}>
          <Hero kind={kind} color={color} />
          <button
            onClick={onClose}
            aria-label="بستن"
            className="btn-neon absolute top-3 left-3 rounded-full border border-white/10 bg-black/50 p-2 text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            <X size={16} />
          </button>
          <div
            className="absolute top-3 right-3 rounded-full px-3 py-1 text-[10px] font-black"
            style={{ backgroundColor: `${color}22`, color, border: `1px solid ${color}55` }}
          >
            {ENEMY_ROLE[kind]}
          </div>
        </div>

        <div className="px-5 pb-5 text-right">
          {/* title */}
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black text-white">{ENEMY_FA[kind]}</h2>
              <div className="font-display text-[11px] tracking-[0.2em] text-slate-500" dir="ltr">
                {kind.toUpperCase()}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.05] px-2.5 py-1 text-[10px] font-bold text-slate-300">
                <MapPin size={11} style={{ color }} />
                {boss ? `باس موج ${ENEMY_UNLOCK[kind]}` : kind === 'mini' ? 'همراه اسپلیتر' : `از موج ${ENEMY_UNLOCK[kind]}`}
              </span>
              <span className="inline-flex items-center gap-0.5" dir="ltr" title={`تهدید ${threat} از ۵`}>
                {Array.from({ length: 5 }, (_, i) => (
                  <Flame key={i} size={13} style={{ color: i < threat ? color : undefined }} className={i < threat ? '' : 'text-slate-700'} fill={i < threat ? 'currentColor' : 'none'} />
                ))}
              </span>
            </div>
          </div>

          {CALLOUT[kind] && (
            <div
              className="mt-3 rounded-xl px-3 py-2 text-center text-[12px] font-extrabold"
              style={{ backgroundColor: `${color}14`, color, border: `1px dashed ${color}44` }}
            >
              {CALLOUT[kind]}
            </div>
          )}

          {/* stats */}
          <div className="mt-4 space-y-2.5">
            {bars.map((b) => (
              <div key={b.label} className="flex items-center gap-2.5">
                <span className="flex w-16 shrink-0 items-center gap-1.5 text-[11px] font-bold text-slate-400">
                  <b.icon size={12} style={{ color }} />
                  {b.label}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
                  <div
                    className="h-full rounded-full transition-[width]"
                    style={{
                      width: `${Math.max(6, Math.sqrt(b.value / b.max) * 100)}%`,
                      background: `linear-gradient(to left, ${color}, ${color}88)`,
                      boxShadow: `0 0 10px ${color}88`,
                    }}
                  />
                </div>
                <span className="tabular w-14 shrink-0 text-left text-[11px] font-bold text-slate-200" dir="ltr">
                  {b.fmt(b.value)}
                </span>
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <span className="tabular flex-1 rounded-lg bg-white/[0.04] px-2 py-1.5 text-center text-[10.5px] font-bold text-slate-300" dir="ltr">
                <Star size={10} className="mb-0.5 inline text-amber-200" /> {stats.xp} XP
              </span>
              <span className="tabular flex-1 rounded-lg bg-white/[0.04] px-2 py-1.5 text-center text-[10.5px] font-bold text-slate-300" dir="ltr">
                ✦ {stats.score} PTS
              </span>
            </div>
          </div>

          {/* lore + tip */}
          <p className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5 text-[12px] leading-6 text-slate-300">
            <span style={{ color }}>«</span>
            {ENEMY_LORE[kind]}
            <span style={{ color }}>»</span>
          </p>
          <p className="mt-2 rounded-xl px-3.5 py-2.5 text-[12px] leading-6 text-slate-400" style={{ backgroundColor: `${color}0d` }}>
            <span className="font-extrabold" style={{ color }}>
              💡 نکته نبرد:{' '}
            </span>
            {ENEMY_TIP[kind]}
          </p>
          {!boss && kind !== 'mini' && (
            <p className="mt-2 text-center text-[10.5px] text-slate-600">
              نسخه <span className="font-bold text-amber-200/90">الیت طلایی</span> — ۳.۲× جان، ۵× تجربه، یه affix مرگبار
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
