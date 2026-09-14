import { RotateCcw, X } from 'lucide-react';
import { DEFAULT_SETTINGS, type SavedSettings } from '../game/storage';

interface Props {
  settings: SavedSettings;
  onChange: (s: SavedSettings) => void;
  onClose: () => void;
}

const DIFFS = [
  { id: 'easy', fa: 'آسان', en: 'CHILL', desc: 'راحت و آرام' },
  { id: 'normal', fa: 'معمولی', en: 'BALANCED', desc: 'تجربه استاندارد' },
  { id: 'hard', fa: 'سخت', en: 'SPICY', desc: 'دشمنان قوی‌تر' },
  { id: 'insane', fa: 'جهنمی', en: 'VOID', desc: 'فقط افسانه‌ها' },
] as const;

const SPEEDS = [
  { id: 0.9, fa: 'آرام', en: '0.9×' },
  { id: 1, fa: 'استاندارد', en: '1×' },
  { id: 1.25, fa: 'توربو', en: '1.25×' },
] as const;

const QUALITIES = [
  { id: 'auto', fa: 'خودکار', en: 'AUTO', desc: 'FPS افتاد ← سبک می‌شود' },
  { id: 'high', fa: 'سینمایی', en: 'CINEMA', desc: 'پر افکت · قوی‌ها' },
  { id: 'balanced', fa: 'متعادل', en: 'BALANCED', desc: 'خوب + سبک‌تر' },
  { id: 'performance', fa: 'عملکرد', en: 'PERF', desc: 'سیستم متوسط' },
  { id: 'potato', fa: 'سبک', en: 'LITE', desc: 'سیستم ضعیف · ۶۰fps' },
] as const;

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? 'bg-slate-200' : 'bg-white/12'}`}
      aria-label={label}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full transition-all ${on ? 'right-0.5 bg-slate-900' : 'left-0.5 bg-slate-400'}`}
      />
    </button>
  );
}

export default function SettingsModal({ settings, onChange, onClose }: Props) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-md">
      <div className="glass anim-rise my-auto w-full max-w-md rounded-3xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="eyebrow" dir="ltr">SETTINGS</div>
            <h2 className="mt-1 text-lg font-extrabold tracking-tight text-white">تنظیمات</h2>
          </div>
          <button onClick={onClose} className="btn-neon btn-ghost rounded-xl p-2" aria-label="close">
            <X size={17} />
          </button>
        </div>

        <div className="mt-5 text-xs font-extrabold text-slate-300">درجه سختی</div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {DIFFS.map((d) => (
            <button
              key={d.id}
              onClick={() => onChange({ ...settings, difficulty: d.id })}
              className={`card-hover rounded-2xl border p-3 text-right ${
                settings.difficulty === d.id
                  ? 'border-slate-200/40 bg-white/[0.07]'
                  : 'border-white/[0.07] bg-white/[0.025]'
              }`}
            >
              <div className="text-[13px] font-extrabold text-white">{d.fa}</div>
              <div className="font-display tabular text-[10px] tracking-[0.14em] text-slate-500" dir="ltr">
                {d.en}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">{d.desc}</div>
            </button>
          ))}
        </div>

        <div className="mt-4 text-xs font-extrabold text-slate-300">سرعت بازی</div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {SPEEDS.map((s) => (
            <button
              key={s.id}
              onClick={() => onChange({ ...settings, gameSpeed: s.id })}
              className={`card-hover rounded-2xl border p-3 text-center ${
                settings.gameSpeed === s.id
                  ? 'border-slate-200/40 bg-white/[0.07]'
                  : 'border-white/[0.07] bg-white/[0.025]'
              }`}
            >
              <div className="text-[13px] font-extrabold text-white">{s.fa}</div>
              <div className="font-display tabular text-[10px] text-slate-500" dir="ltr">
                {s.en}
              </div>
            </button>
          ))}
        </div>

        <div className="mt-4 text-xs font-extrabold text-slate-300">کیفیت گرافیک — سبک ولی همچنان جذاب</div>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {QUALITIES.map((q) => {
            const active = (settings.qualityMode ?? 'auto') === q.id;
            return (
              <button
                key={q.id}
                onClick={() => onChange({ ...settings, qualityMode: q.id, autoQuality: q.id === 'auto' })}
                className={`card-hover rounded-2xl border p-3 text-right ${
                  active
                    ? 'border-cyan-200/40 bg-cyan-300/[0.08] shadow-[0_0_20px_rgba(0,240,255,0.15)]'
                    : 'border-white/[0.07] bg-white/[0.025]'
                }`}
              >
                <div className="text-[13px] font-extrabold text-white">{q.fa}</div>
                <div className="font-display tabular text-[10px] tracking-[0.14em] text-slate-500" dir="ltr">
                  {q.en}
                </div>
                <div className="mt-1 text-[11px] text-slate-500">{q.desc}</div>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] leading-5 text-slate-500">
          حالت سبک: رزولوشن کمتر + ذره کمتر، ولی فلش انفجار و شوک‌ویو می‌ماند — جذابیت کم نمی‌شود.
        </p>

        <div className="mt-5 space-y-4">
          {[
            { label: 'تراکم ذرات', pct: Math.round(settings.particles * 100), min: 0.2, max: 1, step: 0.1, val: settings.particles, set: (v: number) => onChange({ ...settings, particles: v }) },
            { label: 'موزیک', pct: Math.round(settings.musicVol * 100), min: 0, max: 1, step: 0.1, val: settings.musicVol, set: (v: number) => onChange({ ...settings, musicVol: v, muted: false }) },
            { label: 'افکت‌ها', pct: Math.round(settings.sfxVol * 100), min: 0, max: 1, step: 0.1, val: settings.sfxVol, set: (v: number) => onChange({ ...settings, sfxVol: v, muted: false }) },
          ].map((r) => (
            <div key={r.label}>
              <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                <span>{r.label}</span>
                <span className="font-display tabular text-slate-500" dir="ltr">{r.pct}%</span>
              </div>
              <input
                type="range"
                min={r.min}
                max={r.max}
                step={r.step}
                value={r.val}
                onChange={(e) => r.set(Number(e.target.value))}
                className="mt-2 w-full accent-slate-200"
              />
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-2">
          {[
            { label: 'لرزش صفحه', on: settings.shake, fn: () => onChange({ ...settings, shake: !settings.shake }), hint: '' },
            { label: 'بی‌صدا', on: settings.muted, fn: () => onChange({ ...settings, muted: !settings.muted }), hint: '' },
            { label: 'اعداد دمیج', on: settings.showDamageNumbers, fn: () => onChange({ ...settings, showDamageNumbers: !settings.showDamageNumbers }), hint: 'فقط کریت‌ها' },
            { label: 'نمایش FPS', on: settings.showFps, fn: () => onChange({ ...settings, showFps: !settings.showFps }), hint: 'FPS + سطح کیفیت' },
          ].map((t) => (
            <div key={t.label} className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3.5 py-2.5">
              <div>
                <div className="text-xs font-bold text-slate-200">{t.label}</div>
                {t.hint && <div className="text-[10px] text-slate-500">{t.hint}</div>}
              </div>
              <Toggle on={t.on} onClick={t.fn} label={t.label} />
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          className="btn-neon btn-primary mt-5 w-full rounded-2xl px-5 py-3 text-sm font-black"
        >
          تأیید
        </button>
        <button
          onClick={() => onChange({ ...DEFAULT_SETTINGS, ship: settings.ship })}
          className="btn-neon mx-auto mt-2 inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[11px] font-bold text-slate-500 transition hover:text-slate-300"
        >
          <RotateCcw size={12} /> بازنشانی به پیش‌فرض (کشتی حفظ می‌شود)
        </button>
      </div>
    </div>
  );
}
