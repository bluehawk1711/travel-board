import type { Metadata } from "next";
import { Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import Image from "next/image";
import { Suspense } from "react";
import { APP } from "@travel-board/shared";
import { Providers } from "./providers";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

// Terra Nova Travel typography (DESIGN.md): Plus Jakarta Sans, weights 400–800.
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: `${APP.name} — Explore`,
    template: `%s — ${APP.name}`,
  },
  description: APP.description,
  applicationName: APP.name,
  authors: [{ name: APP.companyName }],
};

function HeaderSkeleton() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/90 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-4">
        <Image
          src="/logo.png"
          alt=""
          width={28}
          height={28}
          className="size-7 rounded-lg"
        />
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
      </div>
    </header>
  );
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${jakarta.variable} ${geistMono.variable} h-full antialiased font-sans`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>
          {/*
            Cache Components: the header reads usePathname() (a client runtime
            hook), so it streams in behind a Suspense boundary after the static
            shell. The fallback keeps the bar's height/brand so the layout
            doesn't shift.
          */}
          <Suspense fallback={<HeaderSkeleton />}>
            <SiteHeader />
          </Suspense>
          {children}
        </Providers>
      </body>
    </html>
  );
}
