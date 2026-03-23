import type { Metadata } from "next";
import { EventsManager } from "@/components/admin/events/EventsManager";

export const metadata: Metadata = { title: "Events" };

export default function AdminEventsPage() {
  return <EventsManager />;
}
