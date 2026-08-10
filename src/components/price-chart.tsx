"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatEuro } from "@/lib/utils";

export function PriceChart({
  data,
}: {
  data: Array<{ at: string; best: number | null; baseline: number | null }>;
}) {
  if (data.length < 2)
    return (
      <div className="grid h-64 place-items-center text-sm text-slate-500">
        Price history will appear after more scans.
      </div>
    );
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ left: 0, right: 8, top: 10, bottom: 0 }}
        >
          <defs>
            <linearGradient id="best-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#67e8f9" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#67e8f9" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,.07)" vertical={false} />
          <XAxis
            dataKey="at"
            tick={{ fill: "#64748b", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            minTickGap={40}
            tickFormatter={(value: string) =>
              new Date(value).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })
            }
          />
          <YAxis
            tick={{ fill: "#64748b", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={56}
            tickFormatter={(value: number) => `€${(value / 100).toFixed(0)}`}
          />
          <Tooltip
            contentStyle={{
              background: "#0f172a",
              border: "1px solid rgba(255,255,255,.12)",
              borderRadius: 12,
            }}
            labelFormatter={(value) => new Date(String(value)).toLocaleString()}
            formatter={(value, name) => [
              formatEuro(Number(value)),
              name === "best" ? "Lowest" : "Reference",
            ]}
          />
          <Area
            type="monotone"
            dataKey="baseline"
            stroke="#a78bfa"
            fill="transparent"
            strokeWidth={2}
            connectNulls
          />
          <Area
            type="monotone"
            dataKey="best"
            stroke="#67e8f9"
            fill="url(#best-fill)"
            strokeWidth={2}
            connectNulls
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
