'use client';
// A muted, looping clip that only plays when on screen and never for people who ask for reduced motion.
import { useEffect, useRef } from 'react';

export default function Film({ src, poster, label, caption }: { src: string; poster: string; label: string; caption?: string }) {
  const v = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = v.current; if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) el.play().catch(() => {}); else el.pause(); }, { threshold: 0.25 });
    io.observe(el); return () => io.disconnect();
  }, []);
  return (
    <figure className="film" style={{ margin: 0 }}>
      <video ref={v} src={src} poster={poster} muted loop playsInline preload="metadata" aria-label={label} />
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}
