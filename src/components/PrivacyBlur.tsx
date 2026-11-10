"use client";

import { useSyncExternalStore } from "react";
import { clsx } from "clsx";

const CHANGE_EVENT = "lifecairn:privacy-blur";

function readHidden(key: string) {
  try {
    return localStorage.getItem(key) === "hidden";
  } catch {
    return false; // storage unavailable (private mode): stay visible
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/**
 * Wraps a section whose sensitive values carry the `private-value` class and
 * adds an eye toggle that blurs them. The choice is remembered per browser.
 */
export function PrivacyBlur({
  storageKey,
  label,
  header,
  children,
}: {
  storageKey: string;
  label: string;
  header: React.ReactNode;
  children: React.ReactNode;
}) {
  const hidden = useSyncExternalStore(subscribe, () => readHidden(storageKey), () => false);

  const toggle = () => {
    try {
      localStorage.setItem(storageKey, hidden ? "shown" : "hidden");
    } catch {
      return;
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  };

  return (
    <div
      className={clsx(
        "flex flex-1 flex-col",
        hidden &&
          "[&_.private-value]:pointer-events-none [&_.private-value]:select-none [&_.private-value]:blur-md"
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">{header}</div>
        <button
          type="button"
          onClick={toggle}
          aria-pressed={hidden}
          aria-label={hidden ? `Show ${label}` : `Hide ${label}`}
          title={hidden ? `Show ${label}` : `Hide ${label}`}
          className="brut-border flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-surface hover:bg-yellow"
        >
          {hidden ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      {children}
    </div>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden>
      <path d="M2 12s3.5-7 10-7c2 0 3.8.7 5.2 1.6M22 12s-3.5 7-10 7c-2 0-3.8-.7-5.2-1.6" strokeLinejoin="round" />
      <path d="M3 3l18 18" strokeLinecap="round" />
    </svg>
  );
}
