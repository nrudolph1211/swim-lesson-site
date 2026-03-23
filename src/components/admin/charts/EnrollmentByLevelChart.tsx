"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { getLevelColor, getLevelName } from "@/lib/swim-utils";

interface Props {
  data: { level: number; count: number }[];
}

export function EnrollmentByLevelChart({ data }: Props) {
  const chartData = data.map((d) => ({
    ...d,
    name: `L${d.level}`,
    fill: getLevelColor(d.level),
  }));

  if (chartData.every((d) => d.count === 0)) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No enrollment data yet.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" fontSize={12} tickLine={false} />
        <YAxis fontSize={12} tickLine={false} allowDecimals={false} />
        <Tooltip
          formatter={(value, _name, props) => [
            `${value} enrolled`,
            getLevelName((props.payload as { level: number }).level),
          ]}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {chartData.map((d) => (
            <Cell key={d.level} fill={d.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
