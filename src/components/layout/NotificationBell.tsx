"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
} from "@/components/ui/popover";
import {
  Bell,
  CheckCheck,
  CloudRain,
  CheckCircle2,
  XCircle,
  ArrowUpCircle,
  Clock,
  CalendarPlus,
  Gift,
  TrendingUp,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface Notification {
  id: string;
  type: string;
  title: string | null;
  message: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
}

const typeIcons: Record<string, React.ElementType> = {
  weather_cancellation: CloudRain,
  enrollment_confirmed: CheckCircle2,
  enrollment_cancelled: XCircle,
  waitlist_promoted: ArrowUpCircle,
  waiver_expiring: Clock,
  session_opening: CalendarPlus,
  makeup_credit: Gift,
  level_promotion: TrendingUp,
  general: Info,
};

export function NotificationBell() {
  const { user } = useAuthContext();
  const router = useRouter();
  const supabase = createClient();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("id, type, title, message, link, read, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);
    if (data) {
      setNotifications(data);
      setUnreadCount(data.filter((n) => !n.read).length);
    }
  }, [user, supabase]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, supabase, fetchNotifications]);

  const markAsRead = async (id: string) => {
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  const markAllRead = async () => {
    if (!user) return;
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const handleClick = async (notification: Notification) => {
    if (!notification.read) {
      await markAsRead(notification.id);
    }
    if (notification.link) {
      router.push(notification.link);
    }
  };

  if (!user) return null;

  return (
    <Popover>
      <PopoverTrigger className="relative inline-flex items-center justify-center rounded-md min-h-[44px] min-w-[44px] p-2 text-foreground/70 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Bell className="size-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
        <span className="sr-only">Notifications</span>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-80 p-0">
        <PopoverHeader className="flex items-center justify-between border-b px-4 py-3">
          <PopoverTitle>Notifications</PopoverTitle>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1 text-xs text-accent hover:underline min-h-[44px] px-2"
            >
              <CheckCheck className="size-3.5" />
              Mark All Read
            </button>
          )}
        </PopoverHeader>

        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No notifications yet
            </div>
          ) : (
            notifications.map((notification) => {
              const Icon = typeIcons[notification.type] || Info;
              return (
                <button
                  key={notification.id}
                  onClick={() => handleClick(notification)}
                  className={cn(
                    "flex w-full items-start gap-3 px-4 py-3 min-h-[44px] text-left transition-colors hover:bg-muted/50 active:bg-muted/70",
                    !notification.read && "bg-accent/5"
                  )}
                >
                  <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="flex-1 overflow-hidden">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">
                        {notification.title || "Notification"}
                      </span>
                      {!notification.read && (
                        <span className="size-1.5 shrink-0 rounded-full bg-accent" />
                      )}
                    </div>
                    {notification.message && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {notification.message}
                      </p>
                    )}
                    <span className="mt-1 text-[11px] text-muted-foreground/70">
                      {formatDistanceToNow(new Date(notification.created_at), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {notifications.length > 0 && (
          <div className="border-t px-4 py-2">
            <button
              onClick={() => router.push("/dashboard")}
              className="w-full text-center text-xs font-medium text-accent hover:underline"
            >
              View All
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
