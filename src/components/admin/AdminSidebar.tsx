"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Calendar,
  Users,
  GraduationCap,
  ClipboardList,
  TrendingUp,
  MessageSquare,
  Download,
  Send,
  CloudOff,
  Clock,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

interface SidebarItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

type SidebarSection = SidebarItem[] ;

const sidebarSections: SidebarSection[] = [
  [
    { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
    { label: "Sessions", href: "/admin/sessions", icon: Calendar },
    { label: "Swimmers", href: "/admin/swimmers", icon: Users },
    { label: "Instructors", href: "/admin/instructors", icon: GraduationCap },
    { label: "Assignments", href: "/admin/assignments", icon: ClipboardList },
    { label: "Promotions", href: "/admin/promotions", icon: TrendingUp },
  ],
  [
    { label: "Surveys", href: "/admin/surveys", icon: MessageSquare },
    { label: "Data Export", href: "/admin/export", icon: Download },
    { label: "Communications", href: "/admin/communicate", icon: Send },
  ],
  [
    { label: "Cancellations", href: "/admin/cancellations", icon: CloudOff },
    { label: "Payroll", href: "/admin/payroll", icon: Clock },
  ],
  [
    { label: "Settings", href: "/admin/settings", icon: Settings },
  ],
];

interface AdminSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
}

export function AdminSidebar({ collapsed, onToggle, onNavigate }: AdminSidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div
        className={cn(
          "flex h-14 items-center border-b px-3",
          collapsed ? "justify-center" : "justify-between"
        )}
      >
        {!collapsed && (
          <span className="font-heading text-sm font-semibold text-primary">
            Admin Panel
          </span>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onToggle}
          className="shrink-0"
        >
          {collapsed ? (
            <PanelLeftOpen className="size-4" />
          ) : (
            <PanelLeftClose className="size-4" />
          )}
          <span className="sr-only">
            {collapsed ? "Expand sidebar" : "Collapse sidebar"}
          </span>
        </Button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-2">
        {sidebarSections.map((section, sectionIndex) => (
          <div key={sectionIndex}>
            {sectionIndex > 0 && (
              <Separator className="my-2" />
            )}
            <div className="flex flex-col gap-0.5">
              {section.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      collapsed && "justify-center px-2",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground/70 hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </div>
  );
}
