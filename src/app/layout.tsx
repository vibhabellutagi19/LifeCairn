import type { Metadata } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import { Sidebar } from "@/components/Sidebar";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "The Roadmap",
  description: "Career, money, health & relationship tracker",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-dvh overflow-x-hidden bg-background text-ink md:flex">
        <Sidebar />
        <main className="min-w-0 max-w-full flex-1 px-4 py-5 pb-10 sm:px-6 md:px-10 md:py-10">
          {children}
        </main>
      </body>
    </html>
  );
}
