import { X } from 'lucide-react';
import type { SavedSettings } from '../game/storage';

interface Props {
  settings: SavedSettings;
  onChange: (s: SavedSettings) => void;
  onClose: () => void;
}

const DIFFS = [
  { id: 'easy', fa: 'آسان', en: 'chill run', desc: 'دمیج و جان دشمن کمتر' },
  { id: 'normal', fa: 'معمولی', en: 'balanced', desc: 'تجربه استاندارد' },
  { id: 'hard', fa: 'سخت', en: 'spicy', desc: 'دشمنان قوی‌تر و بیشتر' },
  { id: 'insane', fa: 'جهنمی', en: 'void-touched', desc: 'فقط برای افسانه‌ها' },
] as const;

const SPEEDS = [
  { id: 0.9, fa: 'آرام', en: '0.9x', desc: 'فرصت بیشتر برای واکنش' },
  { id: 1, fa: 'استاندارد', en: '1x', desc: 'ریتم طراحی‌شده بازی' },
  { id: 1.25, fa: 'توربو', en: '1.25x', desc: '۲۵٪ تندتر، امتیاز زمانی بیشتر' },
] as const;

export default function SettingsModal({ settings, onChange, onClose }: Props) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="glass anim-rise w-full max-w-md rounded-3xl p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-white">تنظیمات</h2>
          <button onClick={onClose} className="rounded-lg bg-white/5 p-2 text-slate-300 hover:bg-white/10" aria-label="close">
            <X size={17} />
          </button>
        </div>

        <div className="mt-4 text-xs font-bold text-slate-300">درجه سختی</div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {DIFFS.map((d) => (
            <button
              key={d.id}
              onClick={() => onChange({ ...settings, difficulty: d.id })}
              className={`rounded-xl border p-3 text-right transition ${
                settings.difficulty === d.id
                  ? 'border-cyan-300/60 bg-cyan-400/10'
                  : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
              }`}
            >
              <div className="text-sm font-black text-white">{d.fa}</div>
              <div className="font-display text-[10px] tracking-wider text-slate-500" dir="ltr">
                {d.en}
              </div>
              <div className="mt-1 text-[11px] text-slate-400">{d.desc}</div>
            </button>
          ))}
        </div>

        <div className="mt-4 text-xs font-bold text-slate-300">سرعت بازی</div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {SPEEDS.map((s) => (
            <button
              key={s.id}
              onClick={() => onChange({ ...settings, gameSpeed: s.id })}
              className={`rounded-xl border p-3 text-center transition ${
                settings.gameSpeed === s.id
                  ? 'border-amber-300/60 bg-amber-400/10'
                  : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
              }`}
            >
              <div className="text-sm font-black text-white">{s.fa}</div>
              <div className="font-display text-[10px] tracking-wider text-slate-500" dir="ltr">
                {s.en}
              </div>
              <div className="mt-1 text-[10px] leading-4 text-slate-400">{s.desc}</div>
            </button>
          ))}
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-300">
            <span>تراکم ذرات</span>
            <span className="font-display text-cyan-300" dir="ltr">
              {Math.round(settings.particles * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0.2}
            max={1}
            step={0.1}
            value={settings.particles}
            onChange={(e) => onChange({ ...settings, particles: Number(e.target.value) })}
            className="mt-2 w-full accent-cyan-400"
          />
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between text-xs font-bold text-slate-300">
            <span>بلندی موزیک</span>
            <span className="font-display text-violet-300" dir="ltr">
              {Math.round(settings.musicVol * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={settings.musicVol}
            onChange={(e) => onChange({ ...settings, musicVol: Number(e.target.value), muted: false })}
            className="mt-2 w-full accent-violet-400"
          />
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between text-xs font-bold text-slate-300">
            <span>بلندی افکت‌ها</span>
            <span className="font-display text-pink-300" dir="ltr">
              {Math.round(settings.sfxVol * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={settings.sfxVol}
            onChange={(e) => onChange({ ...settings, sfxVol: Number(e.target.value), muted: false })}
            className="mt-2 w-full accent-pink-400"
          />
        </div>

        <div className="mt-3 flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2.5">
          <span className="text-xs font-bold text-slate-200">لرزش صفحه</span>
          <button
            onClick={() => onChange({ ...settings, shake: !settings.shake })}
            className={`relative h-6 w-11 rounded-full transition ${settings.shake ? 'bg-cyan-400' : 'bg-white/15'}`}
            aria-label="shake"
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                settings.shake ? 'right-0.5' : 'left-0.5'
              }`}
            />
          </button>
        </div>

        <div className="mt-2 flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2.5">
          <span className="text-xs font-bold text-slate-200">بی‌صدا</span>
          <button
            onClick={() => onChange({ ...settings, muted: !settings.muted })}
            className={`relative h-6 w-11 rounded-full transition ${settings.muted ? 'bg-pink-500' : 'bg-white/15'}`}
            aria-label="muted"
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                settings.muted ? 'right-0.5' : 'left-0.5'
              }`}
            />
          </button>
        </div>

        <div className="mt-2 flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2.5">
          <div>
            <div className="text-xs font-bold text-slate-200">کیفیت خودکار</div>
            <div className="text-[10px] text-slate-500">افت FPS → کاهش ذرات و رزولوشن</div>
          </div>
          <button
            onClick={() => onChange({ ...settings, autoQuality: !settings.autoQuality })}
            className={`relative h-6 w-11 shrink-0 rounded-full transition ${settings.autoQuality ? 'bg-cyan-400' : 'bg-white/15'}`}
            aria-label="auto quality"
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                settings.autoQuality ? 'right-0.5' : 'left-0.5'
              }`}
            />
          </button>
        </div>

        <div className="mt-2 flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2.5">
          <span className="text-xs font-bold text-slate-200">نمایش FPS</span>
          <button
            onClick={() => onChange({ ...settings, showFps: !settings.showFps })}
            className={`relative h-6 w-11 rounded-full transition ${settings.showFps ? 'bg-cyan-400' : 'bg-white/15'}`}
            aria-label="show fps"
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                settings.showFps ? 'right-0.5' : 'left-0.5'
              }`}
            />
          </button>
        </div>

        <button
          onClick={onClose}
          className="btn-neon mt-5 w-full rounded-2xl bg-gradient-to-l from-cyan-400 to-sky-500 px-5 py-3 text-sm font-black text-slate-950"
        >
          تأیید
        </button>
      </div>
    </div>
  );
}
