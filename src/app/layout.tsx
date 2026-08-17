import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: {
    default: "Octaflame OS",
    template: "%s · Octaflame OS",
  },
  description: "Operations Management System for Octaflame — Fiesta Gas distribution, Sorsogon Province.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col tabular-nums">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
