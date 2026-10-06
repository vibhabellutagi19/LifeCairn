"use client";

import { useEffect } from "react";

/** Reveals `.home-scroll` sections (and their staggered children) as they scroll into view. */
export function HomeMotion() {
  useEffect(() => {
    const targets = document.querySelectorAll<HTMLElement>(".home-scroll");
    if (!("IntersectionObserver" in window)) {
      targets.forEach((el) => el.classList.add("is-in"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-in");
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -6% 0px" }
    );
    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // Mouse-follow tilt for [data-tilt] cards (skipped for touch / reduced motion).
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const card = (event.target as Element | null)?.closest<HTMLElement>("[data-tilt]");
      if (!card) return;
      const rect = card.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      card.style.setProperty("--ry", `${(x * 12).toFixed(2)}deg`);
      card.style.setProperty("--rx", `${(-y * 12).toFixed(2)}deg`);
    };
    const onLeave = (event: PointerEvent) => {
      const card = (event.target as Element | null)?.closest<HTMLElement>("[data-tilt]");
      card?.style.removeProperty("--rx");
      card?.style.removeProperty("--ry");
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerout", onLeave);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerout", onLeave);
    };
  }, []);

  return null;
}
