const COLORS = ["#ff5b23", "#ff2d78", "#ffcf3f", "#1f9d55", "#2b6cff"];
const GLYPHS = ["✦", "★", "●", "■", "▲"];

/**
 * Pops a small burst of brand-coloured confetti out of an element; pass `glyphs`
 * (e.g. emoji) to burst those instead. No-op for reduced motion.
 */
export function burstConfetti(source: Element, count = 16, glyphs: string[] = GLYPHS) {
  if (typeof window === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const rect = source.getBoundingClientRect();
  const originX = rect.left + rect.width / 2;
  const originY = rect.top + rect.height / 2;

  for (let i = 0; i < count; i++) {
    const piece = document.createElement("span");
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.6;
    const distance = 40 + Math.random() * 60;
    piece.className = "confetti-piece";
    piece.textContent = glyphs[i % glyphs.length];
    piece.style.left = `${originX}px`;
    piece.style.top = `${originY}px`;
    piece.style.color = COLORS[i % COLORS.length];
    piece.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
    piece.style.setProperty("--dy", `${Math.sin(angle) * distance - 30}px`);
    piece.style.setProperty("--rot", `${Math.round(Math.random() * 540 - 270)}deg`);
    piece.addEventListener("animationend", () => piece.remove());
    document.body.appendChild(piece);
  }
}
