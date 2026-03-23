"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from "@/components/ui/sheet";
import {
  Waves,
  Menu,
  LayoutDashboard,
  Settings,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";

function getInitials(name: string | undefined | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function roleBadgeVariant(role: string | null) {
  switch (role) {
    case "admin":
      return "destructive" as const;
    case "instructor":
      return "secondary" as const;
    default:
      return "outline" as const;
  }
}

export function Navbar() {
  const { user, profile, role, loading, signOut } = useAuthContext();
  const pathname = usePathname();
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/book", label: "Book Lessons" },
    { href: "/events", label: "Camps & Events" },
  ];

  if (user) {
    navLinks.push({ href: "/dashboard", label: "Dashboard" });
  }
  if (role === "instructor" || role === "admin") {
    navLinks.push({ href: "/instructor", label: "Instructor" });
  }
  if (role === "admin") {
    navLinks.push({ href: "/admin", label: "Admin" });
  }

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 w-full bg-white transition-shadow duration-200",
        scrolled && "shadow-sm"
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <Waves className="size-7 text-primary" />
          <span className="font-heading text-lg font-bold text-primary">
            HAC Swim
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive(link.href)
                  ? "bg-primary/10 text-primary"
                  : "text-foreground/70 hover:bg-muted hover:text-foreground"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {!loading && !user && (
            <div className="hidden items-center gap-2 md:flex">
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  Sign In
                </Button>
              </Link>
              <Link href="/register">
                <Button size="sm">Get Started</Button>
              </Link>
            </div>
          )}

          {!loading && user && (
            <>
              <NotificationBell />

              <DropdownMenu>
                <DropdownMenuTrigger className="hidden cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring md:inline-flex">
                  <Avatar>
                    <AvatarFallback>
                      {getInitials(profile?.full_name)}
                    </AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" sideOffset={8} className="w-56">
                  <div className="px-1.5 py-1">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-medium">
                        {profile?.full_name || "User"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {user.email}
                      </span>
                      <Badge
                        variant={roleBadgeVariant(role)}
                        className="mt-1 w-fit capitalize"
                      >
                        {role || "parent"}
                      </Badge>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => router.push("/dashboard")}
                  >
                    <LayoutDashboard className="mr-2 size-4" />
                    Dashboard
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => router.push("/dashboard/settings")}
                  >
                    <Settings className="mr-2 size-4" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="mr-2 size-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}

          {/* Mobile hamburger */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon-sm" }),
                "inline-flex md:hidden"
              )}
            >
              <Menu className="size-5" />
              <span className="sr-only">Menu</span>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 p-0">
              <SheetHeader className="border-b px-4 py-4">
                <SheetTitle className="flex items-center gap-2">
                  <Waves className="size-5 text-primary" />
                  HAC Swim
                </SheetTitle>
              </SheetHeader>

              <nav className="flex flex-col gap-1 p-4">
                {navLinks.map((link) => (
                  <SheetClose key={link.href} render={<span />}>
                    <Link
                      href={link.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "block rounded-md px-3 py-3 min-h-[48px] flex items-center text-base font-medium transition-colors",
                        isActive(link.href)
                          ? "bg-primary/10 text-primary"
                          : "text-foreground/70 hover:bg-muted hover:text-foreground"
                      )}
                    >
                      {link.label}
                    </Link>
                  </SheetClose>
                ))}
              </nav>

              <div className="mt-auto border-t p-4">
                {!loading && !user && (
                  <div className="flex flex-col gap-2">
                    <Link href="/login" onClick={() => setMobileOpen(false)}>
                      <Button variant="outline" className="w-full min-h-[48px]">
                        Sign In
                      </Button>
                    </Link>
                    <Link
                      href="/register"
                      onClick={() => setMobileOpen(false)}
                    >
                      <Button className="w-full min-h-[48px]">Get Started</Button>
                    </Link>
                  </div>
                )}
                {!loading && user && (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback>
                          {getInitials(profile?.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">
                          {profile?.full_name || "User"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {user.email}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full min-h-[48px]"
                      onClick={async () => {
                        setMobileOpen(false);
                        await handleSignOut();
                      }}
                    >
                      <LogOut className="mr-2 size-4" />
                      Sign Out
                    </Button>
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
