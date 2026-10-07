import type { ComponentProps } from "react";
import type { ClerkProvider } from "@clerk/nextjs";

type Appearance = NonNullable<ComponentProps<typeof ClerkProvider>["appearance"]>;

// Mirrors the neo-brutalist theme in globals.css (Clerk needs literal colors, not CSS vars).
const INK = "#16130f";
const ORANGE = "#ff5b23";
const PINK = "#ff2d78";
const YELLOW = "#ffcf3f";
const GREEN = "#1f9d55";
const SURFACE = "#fffdf7";
const MUTED = "#8a8272";

const DISPLAY = "var(--font-space-grotesk), ui-sans-serif, system-ui, sans-serif";

export const clerkAppearance: Appearance = {
  options: {
    logoImageUrl: "/icon.svg",
    logoLinkUrl: "/",
    logoPlacement: "inside",
  },
  variables: {
    colorPrimary: ORANGE,
    colorPrimaryForeground: "#ffffff",
    colorBackground: SURFACE,
    colorForeground: INK,
    colorMutedForeground: MUTED,
    colorInput: SURFACE,
    colorInputForeground: INK,
    colorNeutral: INK,
    colorBorder: INK,
    colorShadow: INK,
    colorRing: ORANGE,
    colorDanger: PINK,
    colorSuccess: GREEN,
    fontFamily: "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
    fontFamilyButtons: DISPLAY,
    borderRadius: "0.5rem",
  },
  elements: {
    // Sign-in / sign-up card
    cardBox: {
      border: `3px solid ${INK}`,
      boxShadow: `6px 6px 0 ${INK}`,
      borderRadius: "0.75rem",
    },
    card: { boxShadow: "none" },
    headerTitle: { fontFamily: DISPLAY, fontWeight: 700, letterSpacing: "-0.01em" },
    formFieldLabel: { fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", fontSize: "0.7rem" },
    formFieldInput: { border: `2px solid ${INK}`, boxShadow: "none" },
    formButtonPrimary: {
      border: `3px solid ${INK}`,
      boxShadow: `3px 3px 0 ${INK}`,
      fontFamily: DISPLAY,
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "0.05em",
      "&:hover": { backgroundColor: ORANGE, transform: "translate(1px, 1px)", boxShadow: `2px 2px 0 ${INK}` },
      "&:active": { transform: "translate(3px, 3px)", boxShadow: "none" },
    },
    socialButtonsBlockButton: { border: `2px solid ${INK}`, fontWeight: 600, "&:hover": { backgroundColor: YELLOW } },
    footerActionLink: { color: ORANGE, fontWeight: 700 },
    footer: { background: "transparent" },

    // User button (sidebar) and its popup
    userButtonAvatarBox: {
      width: "2.25rem",
      height: "2.25rem",
      border: `3px solid ${INK}`,
      borderRadius: "0.5rem",
      boxShadow: `2px 2px 0 ${INK}`,
    },
    userButtonBox: { maxWidth: "100%", minWidth: 0 },
    userButtonTrigger: { maxWidth: "100%", minWidth: 0 },
    userButtonOuterIdentifier: {
      fontFamily: DISPLAY,
      fontWeight: 700,
      maxWidth: "9rem",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
    userButtonPopoverCard: {
      border: `3px solid ${INK}`,
      boxShadow: `5px 5px 0 ${INK}`,
      borderRadius: "0.75rem",
    },
    userButtonPopoverActionButton: { fontWeight: 600, "&:hover": { backgroundColor: YELLOW } },
    userButtonPopoverFooter: { display: "none" },
  },
};
