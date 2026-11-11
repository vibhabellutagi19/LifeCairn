"use client";

import { useRouter } from "next/navigation";

/**
 * The month name in the finance month bar. Tapping it opens the native month
 * picker (an invisible <input type="month"> laid over the label), and picking
 * a month goes there. Works the same on phones and desktop.
 */
export function MonthJump({
  month,
  path,
  children,
}: {
  month: string;
  path: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <label className="relative block cursor-pointer rounded-md px-1 hover:bg-yellow/60">
      {children}
      <input
        type="month"
        aria-label="Jump to a month"
        value={month}
        onClick={(event) => {
          try {
            event.currentTarget.showPicker();
          } catch {
            // Older browsers open the picker on focus anyway.
          }
        }}
        onChange={(event) => {
          if (/^\d{4}-\d{2}$/.test(event.target.value)) {
            router.push(`${path}?${new URLSearchParams({ month: event.target.value })}`);
          }
        }}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </label>
  );
}
