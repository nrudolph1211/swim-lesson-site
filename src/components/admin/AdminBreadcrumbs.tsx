"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

const labelMap: Record<string, string> = {
  admin: "Admin",
  sessions: "Sessions",
  swimmers: "Swimmers",
  instructors: "Instructors",
  enrollments: "Enrollments",
  events: "Events",
  promotions: "Promotions",
  reports: "Reports",
  surveys: "Surveys",
  export: "Data Export",
  communicate: "Communications",
  waivers: "Waivers",
  cancellations: "Cancellations",
  payroll: "Payroll",
  payments: "Payments",
  referrals: "Referrals",
  settings: "Settings",
  classes: "Classes",
};

export function AdminBreadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  // Build breadcrumb items
  const crumbs = segments.map((segment, index) => {
    const href = "/" + segments.slice(0, index + 1).join("/");
    const label = labelMap[segment] || decodeURIComponent(segment);
    const isLast = index === segments.length - 1;
    return { href, label, isLast };
  });

  return (
    <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <Link
        href="/admin"
        className="flex items-center gap-1 hover:text-foreground"
      >
        <Home className="size-3.5" />
      </Link>
      {crumbs.slice(1).map((crumb) => (
        <span key={crumb.href} className="flex items-center gap-1.5">
          <ChevronRight className="size-3.5" />
          {crumb.isLast ? (
            <span className={cn("font-medium text-foreground")}>
              {crumb.label}
            </span>
          ) : (
            <Link href={crumb.href} className="hover:text-foreground">
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
