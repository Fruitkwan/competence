"use client";

import { useEffect, useState } from "react";

const COUNT_UP_MS = 700;

export function CountUp({ value }: { value: string }) {
  const match = /^(\d+(?:\.\d+)?)(.*)$/.exec(value);
  if (!match) return <>{value}</>;
  const decimals = match[1].includes(".") ? match[1].split(".")[1].length : 0;
  return <AnimatedNumber target={Number.parseFloat(match[1])} decimals={decimals} suffix={match[2]} />;
}

function AnimatedNumber({ target, decimals, suffix }: { target: number; decimals: number; suffix: string }) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    let raf = requestAnimationFrame(function tick(now: number) {
      if (reduce) {
        setCurrent(target);
        return;
      }
      const progress = Math.min(1, (now - start) / COUNT_UP_MS);
      setCurrent(target * (1 - Math.pow(1 - progress, 3)));
      if (progress < 1) raf = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(raf);
  }, [target]);

  return <span className="tabular-nums">{current.toFixed(decimals)}{suffix}</span>;
}
