import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format } from "date-fns";
import { COMPETENCIES } from "@/data/interview-coach/constants";
import type { SessionReport } from "@/data/interview-coach/types";

// Palette validated with the dataviz six-checks against the report's white
// surface (light mode): series = deep step of the system coral brand token;
// neutrals carry reference data.
const SERIES = "#C2410C";
const SERIES_SOFT = "rgba(194, 65, 12, 0.20)";
const NEUTRAL = "#64748B";
const GRID = "rgba(15, 23, 42, 0.08)";
const TICK = { fill: "#64748B", fontSize: 11 };

const tooltipStyle = {
  backgroundColor: "#FFFFFF",
  border: "1px solid rgba(15,23,42,0.12)",
  borderRadius: 12,
  color: "#0F172A",
  fontSize: 12,
  padding: "8px 12px",
  boxShadow: "0 8px 24px rgba(15,23,42,0.12)",
} as const;

export function SkillRadar({ report }: { report: SessionReport }) {
  const hasPrev = report.competencies.some((c) => c.trendVsPrev != null);
  const data = report.competencies.map((c) => ({
    label: COMPETENCIES.find((x) => x.id === c.id)?.short ?? c.id,
    fullLabel: COMPETENCIES.find((x) => x.id === c.id)?.label ?? c.id,
    current: c.score,
    previous: c.trendVsPrev != null ? c.score - c.trendVsPrev : undefined,
  }));

  return (
    <figure aria-label="Skill distribution radar chart">
      <ResponsiveContainer width="100%" height={260}>
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke={GRID} />
          <PolarAngleAxis dataKey="label" tick={TICK} />
          {hasPrev && (
            <Radar
              name="Previous"
              dataKey="previous"
              stroke={NEUTRAL}
              strokeDasharray="4 4"
              strokeWidth={2}
              fill="none"
            />
          )}
          <Radar
            name="This interview"
            dataKey="current"
            stroke={SERIES}
            strokeWidth={2}
            fill={SERIES_SOFT}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value: number, name: string) => [value, name]}
            labelFormatter={(_, payload) => payload?.[0]?.payload?.fullLabel ?? ""}
          />
        </RadarChart>
      </ResponsiveContainer>
      {hasPrev && (
        <figcaption className="mt-1 flex justify-center gap-5 text-[11px] text-ink-dim">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full" style={{ background: SERIES }} /> This interview
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full border-b border-dashed" style={{ borderColor: NEUTRAL }} />{" "}
            Previous
          </span>
        </figcaption>
      )}
    </figure>
  );
}

export function ScoreHistoryChart({
  trend,
}: {
  trend: { date: string; score: number; role: string }[];
}) {
  const data = trend.map((t) => ({
    ...t,
    label: format(new Date(t.date), "MMM d"),
  }));

  return (
    <figure aria-label="Score history line chart">
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={{ top: 12, right: 12, bottom: 0, left: -18 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="label" tick={TICK} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 100]} tick={TICK} axisLine={false} tickLine={false} width={46} />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value: number) => [value, "Score"]}
            labelFormatter={(label, payload) =>
              payload?.[0] ? `${label} · ${payload[0].payload.role}` : String(label)
            }
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke={SERIES}
            strokeWidth={2}
            dot={{ r: 4, fill: SERIES, strokeWidth: 0 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </figure>
  );
}

export function ResponseDurationChart({ report }: { report: SessionReport }) {
  return (
    <figure aria-label="Response duration versus expected, per question">
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart
          data={report.responseDurations}
          margin={{ top: 12, right: 12, bottom: 0, left: -4 }}
          barCategoryGap="35%"
        >
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="label" tick={TICK} axisLine={false} tickLine={false} />
          <YAxis tick={TICK} axisLine={false} tickLine={false} width={52} unit="s" />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value: number, name: string) => [
              `${value}s`,
              name === "sec" ? "Your answer" : "Expected",
            ]}
          />
          <Bar dataKey="sec" name="sec" fill={SERIES} radius={[4, 4, 0, 0]} maxBarSize={28} />
          <Line
            type="monotone"
            dataKey="expected"
            name="expected"
            stroke={NEUTRAL}
            strokeWidth={2}
            strokeDasharray="4 4"
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <figcaption className="mt-1 flex justify-center gap-5 text-[11px] text-ink-dim">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES }} /> Your answer
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full border-b border-dashed" style={{ borderColor: NEUTRAL }} />{" "}
          Expected length
        </span>
      </figcaption>
    </figure>
  );
}
