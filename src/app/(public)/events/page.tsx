import type { Metadata } from "next";
import { EventsPageClient } from "@/components/events/EventsPageClient";

export const metadata: Metadata = { title: "Events" };

export default function EventsPage() {
  return <EventsPageClient />;
}
