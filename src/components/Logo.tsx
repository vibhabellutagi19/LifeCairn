// LifeCairn mark: a small stack of three stones. Keep in sync with src/app/icon.svg.
export function Logo({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 64 64" className={className}>
      <rect x="3" y="3" width="58" height="58" rx="13" fill="var(--yellow)" stroke="var(--ink)" strokeWidth="4" />
      <ellipse cx="32" cy="47" rx="19" ry="9" fill="var(--orange)" stroke="var(--ink)" strokeWidth="3.5" />
      <ellipse cx="34" cy="33" rx="13.5" ry="7.5" fill="var(--pink)" stroke="var(--ink)" strokeWidth="3.5" />
      <ellipse cx="31" cy="21" rx="8.5" ry="5.5" fill="var(--surface)" stroke="var(--ink)" strokeWidth="3.5" />
    </svg>
  );
}
