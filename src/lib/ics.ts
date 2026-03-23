/**
 * ICS calendar generation utilities.
 * Generates VEVENT entries for swim lesson schedules,
 * expanding recurring day_of_week patterns across session date ranges
 * and excluding cancelled dates.
 */

const LOCATION = "Heights Athletic Club Pool, 301 E FM 2410 Rd, Harker Heights, TX 76548";

const DAY_MAP: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

interface LessonEvent {
  uid: string;
  summary: string;
  startDate: string; // YYYY-MM-DD
  startTime: string; // HH:MM:SS or HH:MM
  endTime: string;
}

function formatIcsDate(dateStr: string, timeStr: string): string {
  const d = dateStr.replace(/-/g, "");
  const t = timeStr.replace(/:/g, "").slice(0, 6).padEnd(6, "0");
  return `${d}T${t}`;
}

function escapeIcs(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

/**
 * Generate all lesson dates for a class, given session date range and days of week.
 * Excludes dates found in cancelledDates.
 */
export function generateLessonDates(
  sessionStart: string,
  sessionEnd: string,
  daysOfWeek: string[],
  cancelledDates: string[]
): string[] {
  const start = new Date(sessionStart + "T00:00:00");
  const end = new Date(sessionEnd + "T23:59:59");
  const targetDays = daysOfWeek
    .map((d) => DAY_MAP[d])
    .filter((d) => d !== undefined);
  const cancelledSet = new Set(cancelledDates);
  const dates: string[] = [];

  const current = new Date(start);
  while (current <= end) {
    if (targetDays.includes(current.getDay())) {
      const dateStr = current.toISOString().split("T")[0];
      if (!cancelledSet.has(dateStr)) {
        dates.push(dateStr);
      }
    }
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

/**
 * Build a VCALENDAR string from an array of lesson events.
 */
export function buildIcsCalendar(events: LessonEvent[]): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//HAC Swim//Lessons//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:HAC Swim Lessons",
    "X-WR-TIMEZONE:America/Chicago",
  ];

  for (const ev of events) {
    const dtStart = formatIcsDate(ev.startDate, ev.startTime);
    const dtEnd = formatIcsDate(ev.startDate, ev.endTime);

    lines.push(
      "BEGIN:VEVENT",
      `UID:${ev.uid}`,
      `DTSTART;TZID=America/Chicago:${dtStart}`,
      `DTEND;TZID=America/Chicago:${dtEnd}`,
      `SUMMARY:${escapeIcs(ev.summary)}`,
      `LOCATION:${escapeIcs(LOCATION)}`,
      `DTSTAMP:${formatIcsDate(new Date().toISOString().split("T")[0], "000000")}`,
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

/**
 * Build ICS events for a single enrollment (client-side usage).
 */
export function buildEnrollmentIcs(enrollment: {
  id: string;
  swimmerName: string;
  level: number;
  daysOfWeek: string[];
  startTime: string;
  endTime: string;
  sessionStart: string;
  sessionEnd: string;
  cancelledDates: string[];
}): string {
  const dates = generateLessonDates(
    enrollment.sessionStart,
    enrollment.sessionEnd,
    enrollment.daysOfWeek,
    enrollment.cancelledDates
  );

  const events: LessonEvent[] = dates.map((date, i) => ({
    uid: `${enrollment.id}-${i}@hacswim.com`,
    summary: `HAC Swim - Level ${enrollment.level} (${enrollment.swimmerName})`,
    startDate: date,
    startTime: enrollment.startTime,
    endTime: enrollment.endTime,
  }));

  return buildIcsCalendar(events);
}
