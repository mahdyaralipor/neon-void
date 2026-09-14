import { useEffect, useRef } from 'react';

/** Lightweight animated menu backdrop: drifting starfield + breathing nebula.
 *  DPR capped at 1, ~70 stars, no gameplay cost — pure first-impression juice. */
export default function MenuBackdrop() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    let w = 0;
    let h = 0;
    const stars = Array.from({ length: 90 }, () => ({
      x: Math.random(),
      y: Math.random(),
      z: 0.2 + Math.random() * 0.8,
      tw: Math.random() * Math.PI * 2,
    }));
    const resize = () => {
      const parent = cv.parentElement;
      w = parent ? parent.clientWidth : window.innerWidth;
      h = parent ? parent.clientHeight : window.innerHeight;
      cv.width = w;
      cv.height = h;
      cv.style.width = `${w}px`;
      cv.style.height = `${h}px`;
    };
    resize();
    window.addEventListener('resize', resize);
    const loop = (tms: number) => {
      const t = tms / 1000;
      ctx.fillStyle = '#050514';
      ctx.fillRect(0, 0, w, h);
      // nebula breath
      const g1 = ctx.createRadialGradient(
        w * 0.25 + Math.sin(t * 0.1) * 20, h * 0.3, 0,
        w * 0.25, h * 0.3, Math.max(w, h) * 0.5,
      );
      g1.addColorStop(0, 'rgba(0,120,180,0.16)');
      g1.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g1;
      ctx.fillRect(0, 0, w, h);
      const g2 = ctx.createRadialGradient(
        w * 0.78, h * 0.68 + Math.cos(t * 0.08) * 18, 0,
        w * 0.78, h * 0.68, Math.max(w, h) * 0.45,
      );
      g2.addColorStop(0, 'rgba(180,30,90,0.13)');
      g2.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, w, h);
      // stars drift + twinkle
      for (const s of stars) {
        const x = ((s.x + t * 0.004 * s.z) % 1) * w;
        const y = (s.y * h + Math.sin(t * 0.3 + s.tw) * 6 + h) % h;
        const a = 0.25 + s.z * 0.55 + Math.sin(t * 1.4 + s.tw) * 0.12;
        ctx.globalAlpha = Math.max(0.05, Math.min(1, a));
        ctx.fillStyle = s.z > 0.75 ? '#c8ecff' : '#e8ecf5';
        const sz = s.z > 0.75 ? 2 : 1.3;
        ctx.fillRect(x, y, sz, sz);
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      className="pointer-events-none absolute inset-0 opacity-90"
      aria-hidden
    />
  );
}
