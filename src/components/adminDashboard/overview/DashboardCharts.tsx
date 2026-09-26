import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const chartCardClass =
  "rounded-xl border border-border bg-card p-5 shadow-card";

function EmptyChart({ height, label }: { height: number; label: string }) {
  return (
    <div
      className="flex items-center justify-center text-sm text-muted-foreground"
      style={{ height }}
    >
      {label}
    </div>
  );
}

interface DashboardChartsProps {
  jobPostsData?: Array<{ month: string; posts: number }>;
  applicationsData?: Array<{ category: string; apps: number }>;
  approvalData?: Array<{ week: string; rate: number }>;
}

export function DashboardCharts({
  jobPostsData = [],
  applicationsData = [],
  approvalData = []
}: DashboardChartsProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Job Posts Over Time */}
        <div className={chartCardClass}>
          <h3 className="mb-4 text-sm font-semibold text-card-foreground">
            Job Posts Over Time
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={jobPostsData}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                vertical={false}
              />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                interval="preserveStartEnd"
                minTickGap={16}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Line
                type="monotone"
                dataKey="posts"
                stroke="hsl(var(--accent))"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: "hsl(var(--accent))" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Applications Per Category */}
        <div className={chartCardClass}>
          <h3 className="mb-4 text-sm font-semibold text-card-foreground ">
            Applications by Category
          </h3>
          {applicationsData.length === 0 ? (
            <EmptyChart height={240} label="No categorized applications yet" />
          ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={applicationsData}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                vertical={false}
              />
              <XAxis
                dataKey="category"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Bar
                dataKey="apps"
                fill="hsl(var(--primary))"
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Employer Approval Rate */}
      <div className={chartCardClass}>
        <h3 className="mb-4 text-sm font-semibold text-card-foreground">
          Employer Approval Rate (%)
        </h3>
        {approvalData.length === 0 ? (
          <EmptyChart height={200} label="Not enough data yet" />
        ) : (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={approvalData}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              vertical={false}
            />
            <XAxis
              dataKey="week"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            />
            <YAxis
              domain={[70, 100]}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: "12px",
              }}
            />
            <defs>
              <linearGradient id="approvalGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.2} />
                <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="rate"
              stroke="hsl(var(--success))"
              strokeWidth={2}
              fill="url(#approvalGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
