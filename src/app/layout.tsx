import type { Metadata } from "next";
import { Outfit, DM_Sans } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { NetworkOffline } from "@/components/ui/network-offline";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-heading",
  subsets: ["latin"],
  display: "swap",
});

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    template: "%s — HAC Swim",
    default: "Heights Athletic Club — Swim Lessons",
  },
  description:
    "Swim lesson tracking and scheduling at Heights Athletic Club in Harker Heights, TX. Group and private lessons for all ages and skill levels.",
  keywords: [
    "swim lessons",
    "Harker Heights",
    "Heights Athletic Club",
    "swimming",
    "kids swim lessons",
    "learn to swim",
    "Texas swim school",
  ],
  openGraph: {
    title: "Heights Athletic Club — Swim Lessons",
    description:
      "Swim lesson tracking and scheduling at Heights Athletic Club in Harker Heights, TX. Group and private lessons for all ages and skill levels.",
    siteName: "HAC Swim",
    locale: "en_US",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${outfit.variable} ${dmSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-white focus:outline-none"
        >
          Skip to main content
        </a>
        <NetworkOffline />
        <ErrorBoundary>
          <AuthProvider>
            <Navbar />
            <main id="main-content" className="flex-1">{children}</main>
            <Footer />
          </AuthProvider>
        </ErrorBoundary>
        <Toaster />
      </body>
    </html>
  );
}
