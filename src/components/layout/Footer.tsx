import Link from "next/link";
import { Waves, MapPin, Phone, Mail } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t bg-foreground text-white/80">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Branding */}
          <div>
            <Link href="/" className="flex items-center gap-2 text-white">
              <Waves className="size-6" />
              <span className="font-heading text-lg font-bold">HAC Swim</span>
            </Link>
            <p className="mt-3 text-sm leading-relaxed">
              Heights Athletic Club offers year-round swim lessons for all ages
              and skill levels in Harker Heights, Texas.
            </p>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-heading text-sm font-semibold uppercase tracking-wider text-white">
              Contact Us
            </h3>
            <ul className="mt-3 space-y-2.5 text-sm">
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 size-4 shrink-0" />
                <span>301 E FM 2410 Rd, Harker Heights, TX 76548</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="size-4 shrink-0" />
                <a href="tel:+12542135543" className="hover:text-white">
                  (254) 213-5543
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="size-4 shrink-0" />
                <a href="mailto:swim@hacswim.com" className="hover:text-white">
                  swim@hacswim.com
                </a>
              </li>
            </ul>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-heading text-sm font-semibold uppercase tracking-wider text-white">
              Quick Links
            </h3>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href="/book" className="hover:text-white">
                  Book Lessons
                </Link>
              </li>
              <li>
                <Link href="/events" className="hover:text-white">
                  Camps & Events
                </Link>
              </li>
              <li>
                <Link href="/login" className="hover:text-white">
                  Sign In
                </Link>
              </li>
              <li>
                <Link href="/register" className="hover:text-white">
                  Register
                </Link>
              </li>
            </ul>
          </div>

          {/* Information */}
          <div>
            <h3 className="font-heading text-sm font-semibold uppercase tracking-wider text-white">
              Information
            </h3>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href="/privacy" className="hover:text-white">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-white">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-white/10 pt-6 text-center text-xs">
          &copy; {new Date().getFullYear()} Heights Athletic Club. All rights
          reserved.
        </div>
      </div>
    </footer>
  );
}
