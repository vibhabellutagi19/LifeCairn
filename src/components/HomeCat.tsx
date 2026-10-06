"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import type { CatNudge } from "@/lib/catNudges";

type Phase = "walking" | "waving" | "idle";
export type CatPhase = Phase | "napping";
type Bubble = { kind: "hi"; message: string } | { kind: "nudge"; nudge: CatNudge };

const GREETINGS = [
  "Hi Vibs! 👋",
  "Meow! Ready to shine today? ✨",
  "Hey you! I saved your spot 🐾",
  "Purr-fect timing, Vibs! 💛",
  "Welcome back! One small step today? 🌱",
  "Psst… you've got this, Vibs 💪",
];

/** Random greeting that differs from the last one shown (remembered in localStorage). */
function pickGreeting() {
  let last = -1;
  try {
    last = Number(localStorage.getItem("roadmap:cat-greeting") ?? -1);
  } catch {}
  let next = Math.floor(Math.random() * GREETINGS.length);
  if (next === last) next = (next + 1) % GREETINGS.length;
  try {
    localStorage.setItem("roadmap:cat-greeting", String(next));
  } catch {}
  return GREETINGS[next];
}

export function HomeCat({ nudges }: { nudges: CatNudge[] }) {
  const [phase, setPhase] = useState<Phase>("walking");
  const [bubble, setBubble] = useState<Bubble | null>(null);
  const [hops, setHops] = useState(0);
  const cursor = useRef<number | null>(null);

  function greet() {
    setPhase("waving");
    setBubble((current) => current ?? { kind: "hi", message: pickGreeting() });
  }

  // Skip the stroll for people who prefer reduced motion: just say hi.
  useEffect(() => {
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setTimeout(greet, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (phase !== "waving") return;
    const timer = window.setTimeout(() => {
      setPhase("idle");
      setBubble((current) => (current?.kind === "hi" ? null : current));
    }, 4200);
    return () => window.clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (bubble?.kind !== "nudge") return;
    const timer = window.setTimeout(() => setBubble(null), 16000);
    return () => window.clearTimeout(timer);
  }, [bubble]);

  useEffect(() => {
    if (!bubble) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setBubble(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bubble]);

  function poke() {
    if (phase === "waving") setPhase("idle");
    cursor.current =
      cursor.current === null
        ? Math.floor(Math.random() * nudges.length)
        : (cursor.current + 1) % nudges.length;
    setBubble({ kind: "nudge", nudge: nudges[cursor.current] });
    setHops((count) => count + 1);
  }

  return (
    <div className="cat-track">
      <div
        className={clsx("cat-walker", phase === "walking" && "is-walking")}
        onAnimationEnd={(event) => {
          if (event.target === event.currentTarget && phase === "walking") greet();
        }}
      >
        {bubble ? (
          <div role="status" className="cat-bubble">
            {bubble.kind === "hi" ? (
              <p className="font-display text-lg font-bold leading-snug">{bubble.message}</p>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setBubble(null)}
                  aria-label="Dismiss"
                  className="absolute right-1.5 top-1 flex h-7 w-7 items-center justify-center text-sm font-bold text-muted"
                >
                  ✕
                </button>
                <p className="pr-5 text-sm font-semibold leading-snug">
                  <span aria-hidden className="mr-1">{bubble.nudge.emoji}</span>
                  {bubble.nudge.text}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  {bubble.nudge.href ? (
                    <Link
                      href={bubble.nudge.href}
                      className="brut-border brut-shadow-sm brut-press inline-flex min-h-9 items-center rounded-full bg-orange px-3 py-1 text-xs font-bold uppercase tracking-wide text-white"
                    >
                      {bubble.nudge.cta ?? "Let's go"} →
                    </Link>
                  ) : null}
                  {nudges.length > 1 ? (
                    <button type="button" onClick={poke} className="text-xs font-bold text-muted underline decoration-2 underline-offset-4">
                      Another idea
                    </button>
                  ) : null}
                </div>
              </>
            )}
          </div>
        ) : null}
        <button
          type="button"
          onClick={poke}
          aria-label="Pet the cat for a nudge"
          className="cat-button"
        >
          <span key={hops} className={clsx("block", hops > 0 && "cat-hop")}>
            <CatSvg phase={phase} />
          </span>
        </button>
      </div>
    </div>
  );
}

const INK = "#16130f";
const FUR = "#ffcf3f";
const FUR_SHADE = "#f2b42a";
const CREAM = "#fff7e0";
const PINK = "#ff2d78";
const STRIPE = "#ff8a3d";

/** A chubby leg with a round paw; the toe beans sit underneath, so they show when it waves. */
function Leg({ x, y = 56, className, shade = false }: { x: number; y?: number; className: string; shade?: boolean }) {
  const fill = shade ? FUR_SHADE : FUR;
  return (
    <g className={clsx("cat-leg", className)}>
      <rect x={x} y={y} width={12} height={81 - y} rx={6} fill={fill} stroke={INK} strokeWidth={2.6} />
      <ellipse cx={x + 6.5} cy={81} rx={7.6} ry={4.6} fill={shade ? FUR_SHADE : CREAM} stroke={INK} strokeWidth={2.6} />
      {/* toe beans */}
      <ellipse cx={x + 6.5} cy={83.2} rx={2.8} ry={1.5} fill={PINK} opacity={0.85} />
      <circle cx={x + 2.6} cy={81.6} r={1.1} fill={PINK} opacity={0.85} />
      <circle cx={x + 6.5} cy={80.6} r={1.1} fill={PINK} opacity={0.85} />
      <circle cx={x + 10.4} cy={81.6} r={1.1} fill={PINK} opacity={0.85} />
      <path d={`M${x + 4.5} ${74}h4`} stroke={STRIPE} strokeWidth={2.4} strokeLinecap="round" />
    </g>
  );
}

export function CatSvg({ phase }: { phase: CatPhase }) {
  return (
    <svg viewBox="0 0 124 92" className="cat-svg block w-full overflow-visible" data-phase={phase} aria-hidden>
      <ellipse cx={60} cy={88} rx={38} ry={3.4} fill="#000" opacity={0.3} />
      <g className="cat-bob">
        {/* far side legs, a shade darker */}
        <Leg x={33} className="cat-leg-b cat-far" shade />
        <Leg x={63} className="cat-leg-a cat-far" shade />

        {/* curly tail with a cream tip */}
        <g transform="translate(0 -8)">
        <g className="cat-tail">
          <path d="M26 62C8 64 2 46 10 34C15 26 25 28 23 36" fill="none" stroke={INK} strokeWidth={11} strokeLinecap="round" />
          <path d="M26 62C8 64 2 46 10 34C15 26 25 28 23 36" fill="none" stroke={FUR} strokeWidth={5.6} strokeLinecap="round" />
          <path d="M14 31C17 28 22 29 23 35" fill="none" stroke={CREAM} strokeWidth={5.6} strokeLinecap="round" />
        </g>

        {/* round body with a fluffy cream belly */}
        <path d="M22 50C22 40 34 36 48 36H62C74 36 82 44 82 56C82 68 72 74 60 74H38C28 74 22 66 22 58Z" fill={FUR} stroke={INK} strokeWidth={3} />
        <path d="M34 70C38 64 46 62 54 63C60 64 66 66 70 71C60 74 44 74 34 70Z" fill={CREAM} />
        <path d="M38 38q2 6 0 10M48 37q2 7 0 12M58 37q2 6 0 10" fill="none" stroke={STRIPE} strokeWidth={3.4} strokeLinecap="round" />
        </g>

        <Leg x={25} className="cat-leg-a" />

        {/* big round head */}
        <g transform="translate(0 -8)">
          {/* ears */}
          <path d="M61 27C59 17 61 7 65 3C72 6 78 12 81 18Z" fill={FUR} stroke={INK} strokeWidth={3} strokeLinejoin="round" />
          <path d="M109 27C111 17 109 7 105 3C98 6 92 12 89 18Z" fill={FUR} stroke={INK} strokeWidth={3} strokeLinejoin="round" />
          <path d="M65 20C64 14 65 10 67 8C71 10 74 13 76 16Z" fill={PINK} opacity={0.75} />
          <path d="M105 20C106 14 105 10 103 8C99 10 96 13 94 16Z" fill={PINK} opacity={0.75} />

          <ellipse cx={85} cy={40} rx={27} ry={24} fill={FUR} stroke={INK} strokeWidth={3} />
          {/* little bow by the left ear */}
          <path d="M70 20l-6.5-4.5v9zM70 20l6.5-4.5v9z" fill={PINK} stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />
          <circle cx={70} cy={20} r={2.2} fill={PINK} stroke={INK} strokeWidth={1.4} />
          <path d="M79 18q1 5 0 8M85 17q1 6 0 9M91 18q1 5 0 8" fill="none" stroke={STRIPE} strokeWidth={2.8} strokeLinecap="round" />

          {/* muzzle + blush */}
          <ellipse cx={85} cy={50} rx={9.5} ry={6.5} fill={CREAM} />
          <ellipse cx={66} cy={49} rx={5} ry={3} fill={PINK} opacity={0.38} />
          <ellipse cx={104} cy={49} rx={5} ry={3} fill={PINK} opacity={0.38} />

          {/* sparkly eyes */}
          <g className="cat-eye">
            <ellipse cx={73.5} cy={39} rx={5.6} ry={7} fill={INK} />
            <circle cx={75.6} cy={36.2} r={2.4} fill="#fff" />
            <circle cx={71.8} cy={42} r={1.1} fill="#fff" />
          </g>
          <g className="cat-eye">
            <ellipse cx={96.5} cy={39} rx={5.6} ry={7} fill={INK} />
            <circle cx={98.6} cy={36.2} r={2.4} fill="#fff" />
            <circle cx={94.8} cy={42} r={1.1} fill="#fff" />
          </g>

          {/* heart nose, ω mouth, tiny blep */}
          <path d="M85 49.6c-1.6-2.2-4.2-.6-2.6 1.2L85 53l2.6-2.2c1.6-1.8-1-3.4-2.6-1.2z" fill={PINK} stroke={INK} strokeWidth={1.2} strokeLinejoin="round" />
          <path d="M85 53v1.2M85 54.2c-1.3 2.2-4 2.2-4.8.2M85 54.2c1.3 2.2 4 2.2 4.8.2" fill="none" stroke={INK} strokeWidth={1.5} strokeLinecap="round" />
          <path d="M83.6 55.4q1.4 3 2.8 0" fill={PINK} stroke={INK} strokeWidth={1} />

          {/* whiskers */}
          <path d="M60 44l-8-2M60 47.5l-8 .5M60 51l-7 3M110 44l8-2M110 47.5l8 .5M110 51l7 3" stroke={INK} strokeWidth={1.3} strokeLinecap="round" />

          {/* collar + bell */}
          <path d="M68 61Q85 70 102 61" fill="none" stroke={INK} strokeWidth={7} strokeLinecap="round" />
          <path d="M68 61Q85 70 102 61" fill="none" stroke={PINK} strokeWidth={3.6} strokeLinecap="round" />
          <circle cx={85} cy={68.5} r={4.2} fill="#ffd84d" stroke={INK} strokeWidth={2} />
          <path d="M83.4 68.5h3.2M85 69v2" stroke={INK} strokeWidth={1.1} strokeLinecap="round" />
        </g>

        {/* near front leg drawn last, so its raised paw shows in front when waving */}
        <Leg x={57} y={58} className="cat-leg-b cat-wave" />
      </g>
    </svg>
  );
}
