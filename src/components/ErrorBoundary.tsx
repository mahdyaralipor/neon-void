import { Component, type ReactNode } from 'react';
import { RotateCcw, Trash2, TriangleAlert } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Last-resort crash screen — a corrupted save or render bug must never
 *  leave the player staring at a blank page. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error): void {
    try {
      console.error('[neon-void] crash:', error);
    } catch {
      /* ignore */
    }
  }

  private reload = (): void => {
    window.location.reload();
  };

  private wipeAndReload = (): void => {
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && k.startsWith('neon-void-')) localStorage.removeItem(k);
      }
    } catch {
      /* ignore */
    }
    window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050514] px-4" dir="rtl">
        <div className="glass anim-rise w-full max-w-sm rounded-3xl p-7 text-center">
          <span className="mx-auto flex w-fit rounded-2xl bg-rose-400/10 p-3 text-rose-300">
            <TriangleAlert size={22} />
          </span>
          <h1 className="mt-4 text-lg font-extrabold text-white">خلأ دچار اختلال شد!</h1>
          <p className="mt-2 text-[12px] leading-6 text-slate-400">
            یه خطای غیرمنتظره بازی رو متوقف کرد. معمولاً رفرش کافیه؛ اگه تکرار شد،
            ذخیره محلی رو پاک کن (رکوردها و آزمایشگاه ریست می‌شن).
          </p>
          <p className="font-display mt-3 truncate text-[10px] text-slate-600" dir="ltr">
            {this.state.error.message}
          </p>
          <div className="mt-5 flex flex-col gap-2">
            <button
              onClick={this.reload}
              className="btn-neon btn-primary inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-black"
            >
              <RotateCcw size={16} /> تلاش دوباره
            </button>
            <button
              onClick={this.wipeAndReload}
              className="btn-neon btn-ghost inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-[13px] font-bold"
            >
              <Trash2 size={15} className="text-slate-400" /> پاک‌سازی ذخیره و شروع تازه
            </button>
          </div>
        </div>
      </div>
    );
  }
}
