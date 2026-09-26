interface MiniChartProps {
  data: number[];
  className?: string;
}

export function MiniChart({ data, className = "" }: MiniChartProps) {
  if (!data.length) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const h = 40;
  const w = 120;
  const step = w / (data.length - 1);

  const points = data
    .map((v, i) => `${i * step},${h - ((v - min) / range) * (h - 4) - 2}`)
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={`${className}`}
      style={{ width: w, height: h }}
      preserveAspectRatio="none"
    >
      <polyline
        points={points}
        fill="none"
        stroke="hsl(var(--muted-foreground))"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.5"
      />
    </svg>
  );
}
