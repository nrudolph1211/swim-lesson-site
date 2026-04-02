import { Phone } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t bg-foreground text-white/80">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-center gap-2 text-center text-sm sm:flex-row sm:gap-4">
          <span>&copy; {new Date().getFullYear()} Heights Athletic Club</span>
          <span className="hidden sm:inline" aria-hidden="true">&middot;</span>
          <a
            href="tel:+12542135543"
            className="flex items-center gap-1.5 hover:text-white"
          >
            <Phone className="size-3.5 shrink-0" />
            (254) 213-5543
          </a>
        </div>
      </div>
    </footer>
  );
}
