"use client";
import { useEffect, useRef } from "react";

/** Drifting embers behind landing / writer / admin pages. Cheap, 2D canvas. */
export default function Embers({ count = 70 }: { count?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext("2d")!;
    let w = 0, h = 0, raf = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      w = c.clientWidth; h = c.clientHeight;
      c.width = w * dpr; c.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);
    const ps = Array.from({ length: count }, () => ({
      x: Math.random() * 1800, y: Math.random() * 1200, r: Math.random() * 1.8 + 0.4,
      vy: -(Math.random() * 12 + 5), ph: Math.random() * 6.28, a: Math.random() * 0.6 + 0.2,
    }));
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let last = performance.now();
    const tick = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.05); last = t;
      ctx.clearRect(0, 0, w, h);
      for (const p of ps) {
        if (!reduce) { p.y += p.vy * dt; p.x += Math.sin(t / 1800 + p.ph) * 8 * dt; }
        if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
        const px = p.x % w;
        const g = ctx.createRadialGradient(px, p.y, 0, px, p.y, p.r * 5);
        g.addColorStop(0, `rgba(255,214,150,${p.a})`);
        g.addColorStop(1, "rgba(255,214,150,0)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(px, p.y, p.r * 5, 0, 6.283); ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, [count]);
  return <canvas ref={ref} className="embers" aria-hidden />;
}
