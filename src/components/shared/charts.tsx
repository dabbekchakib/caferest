import { cn } from "@/lib/utils";

export interface LineChartProps {
  data: number[];
  labels?: string[];
  className?: string;
  height?: number;
  color?: string;
  fill?: boolean;
}

export function LineChart({
  data,
  labels,
  className,
  height = 200,
  color = "var(--color-primary)",
  fill = true,
}: LineChartProps) {
  if (data.length < 2) return null;
  const width = 600;
  const padding = 8;
  const max = Math.max(...data) * 1.1;
  const min = Math.min(...data) * 0.9;
  const range = max - min || 1;
  const stepX = (width - padding * 2) / (data.length - 1);

  const points = data.map((value, i) => {
    const x = padding + i * stepX;
    const y = height - padding - ((value - min) / range) * (height - padding * 2);
    return [x, y] as const;
  });

  const linePath = points.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x} ${y}`).join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1][0]} ${height - padding} L ${points[0][0]} ${height - padding} Z`;
  const gridLines = [0.25, 0.5, 0.75].map((f) => padding + f * (height - padding * 2));

  return (
    <div className={cn("w-full", className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        role="img"
        aria-label="Graphique en courbes"
      >
        <defs>
          <linearGradient id="cr-line-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {gridLines.map((y, i) => (
          <line key={i} x1={padding} y1={y} x2={width - padding} y2={y} stroke="var(--color-border)" strokeWidth="1" strokeDasharray="4 4" />
        ))}
        {fill && <path d={areaPath} fill="url(#cr-line-fill)" />}
        <path d={linePath} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {points.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i === points.length - 1 ? 4 : 3} fill={color} />
        ))}
      </svg>
      {labels && (
        <div className="mt-2 flex justify-between text-[10px] text-[var(--color-muted-foreground)]">
          {labels.map((label, i) => (
            <span key={i}>{label}</span>
          ))}
        </div>
      )}
    </div>
  );
}

export interface BarChartProps {
  data: number[];
  labels?: string[];
  className?: string;
  height?: number;
  color?: string;
}

export function BarChart({ data, labels, className, height = 200, color = "var(--color-primary)" }: BarChartProps) {
  const max = Math.max(...data) * 1.1;
  const barWidth = 60;
  const gap = 20;
  const totalWidth = data.length * (barWidth + gap);
  const barAreaHeight = height - 20;

  return (
    <div className={cn("w-full", className)}>
      <svg viewBox={`0 0 ${totalWidth} ${height}`} width="100%" height={height} role="img" aria-label="Graphique en barres">
        {data.map((value, i) => {
          const barHeight = (value / max) * barAreaHeight;
          const x = i * (barWidth + gap);
          const y = height - barHeight;
          return (
            <rect key={i} x={x} y={y} width={barWidth} height={barHeight} rx="6" fill={color} opacity="0.85">
              <title>{value}</title>
            </rect>
          );
        })}
      </svg>
      {labels && (
        <div className="mt-2 flex justify-between text-[10px] text-[var(--color-muted-foreground)]">
          {labels.map((label, i) => (
            <span key={i} style={{ width: barWidth }} className="shrink-0 text-center">
              {label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
