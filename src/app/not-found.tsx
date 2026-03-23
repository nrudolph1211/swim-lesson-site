import Link from "next/link";
import { Waves } from "lucide-react";

export default function NotFound() {
  return (
    <div className="container mx-auto flex flex-col items-center justify-center min-h-[60vh] py-16 text-center">
      <div className="relative mb-6">
        <Waves className="size-20 text-primary/20" />
        <Waves className="absolute inset-0 size-20 animate-pulse text-primary/40" />
      </div>

      <h1 className="font-heading text-6xl font-bold text-primary">404</h1>
      <h2 className="mt-3 font-heading text-2xl font-semibold">
        Page Not Found
      </h2>
      <p className="mt-2 max-w-md text-muted-foreground">
        Looks like this page took a dive into the deep end. Let&apos;s get you
        back on deck.
      </p>

      <div className="mt-8 flex items-center gap-4">
        <Link
          href="/"
          className="inline-flex items-center rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Go Home
        </Link>
        <a
          href="mailto:swim@hacswim.com"
          className="text-sm font-medium text-accent hover:underline"
        >
          Contact Us
        </a>
      </div>
    </div>
  );
}
