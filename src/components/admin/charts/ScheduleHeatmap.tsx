"use client";

interface Props {
  data: Record<string, number>;
  maxCount: number;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 12 }, (_, i) => i + 7);

function getColor(count: number, maxCount: number): string {
  if (count === 0) return "#f3f4f6";
  const intensity = Math.min(count / Math.max(maxCount, 1), 1);
  const r = Math.round(230 - intensity * (230 - 27));
  const g = Math.round(240 - intensity * (240 - 79));
  const b = Math.round(250 - intensity * (250 - 114));
  return `rgb(${r},${g},${b})`;
}

function formatHour(h: number): string {
  if (h === 0 || h === 12) return "12p";
  return h < 12 ? `${h}a` : `${h - 12}p`;
}

export function ScheduleHeatmap({ data, maxCount }: Props) {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[320px]">
        <div className="mb-1 flex">
          <div className="w-10" />
          {DAYS.map((day) => (
            <div
              key={day}
              className="flex-1 text-center text-[10px] font-medium text-muted-foreground"
            >
              {day}
            </div>
          ))}
        </div>
        {HOURS.map((hour) => (
          <div key={hour} className="flex items-center gap-0.5">
            <div className="w-10 pr-1 text-right text-[10px] text-muted-foreground">
              {formatHour(hour)}
            </div>
            {DAYS.map((day) => {
              const key = `${day}-${hour}`;
              const count = data[key] ?? 0;
              return (
                <div
                  key={key}
                  className="flex-1 rounded-sm"
                  style={{
                    backgroundColor: getColor(count, maxCount),
                    height: 14,
                  }}
                  title={`${day} ${formatHour(hour)}: ${count} class${count !== 1 ? "es" : ""}`}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
