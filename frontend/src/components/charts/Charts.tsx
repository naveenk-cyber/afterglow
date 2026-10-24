import { useEffect, useId, useRef, useState } from 'react';
import type { SeriesPoint } from '../../data/sampleSessions';

/**
 * Charts are hand-built SVG rather than a charting dependency: the shapes here
 * are small, the palette is token-driven, and an extra library would have added
 * more bundle than the whole dashboard. Every chart is responsive through a
 * viewBox, exposes a text summary to assistive technology, and uses native SVG
 * `<title>` elements for per-point tooltips.
 */

const AXIS = 'var(--color-line)';
const MUTED = 'var(--color-ink-subtle)';
const BRAND = 'var(--color-brand)';

const numberFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });

/**
 * Draw in CSS pixels rather than scaling a fixed viewBox.
 *
 * A 640-unit viewBox squeezed into a 320px card halves every label; measuring
 * the container keeps axis text at a readable 11px on phones without making it
 * oversized on desktop.
 */
function useChartWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width;
      if (next) setWidth(Math.max(280, Math.round(next)));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}

interface ChartProps {
  data: SeriesPoint[];
  /** Rendered in the accessible description, e.g. "sessions". */
  unit: string;
  valueFormat?: (value: number) => string;
  height?: number;
  accent?: string;
}

function ChartEmpty({ message }: { message: string }) {
  return (
    <div className="flex h-[150px] items-center justify-center rounded-control border border-dashed border-line text-center">
      <p className="max-w-[22ch] text-xs leading-relaxed text-ink-subtle">{message}</p>
    </div>
  );
}

/** Label every `step`th point, and the last one only when it has room. */
function labelIndices(length: number, step: number): Set<number> {
  const indices = new Set<number>();
  for (let index = 0; index < length; index += step) indices.add(index);
  const last = length - 1;
  const previous = Math.max(...indices);
  if (last - previous >= step) indices.add(last);
  return indices;
}

function chartDescription(data: SeriesPoint[], unit: string, format: (value: number) => string) {
  if (data.length === 0) return `No ${unit} in this range.`;
  const peak = data.reduce((best, point) => (point.value > best.value ? point : best), data[0]);
  const total = data.reduce((sum, point) => sum + point.value, 0);
  return `${unit} by period. Peak ${format(peak.value)} on ${peak.label}; total ${format(total)}.`;
}

export function AreaChart({
  data,
  unit,
  valueFormat = (value) => numberFormat.format(value),
  height = 170,
  accent = BRAND,
}: ChartProps) {
  // Hooks must run before the empty-state early return, otherwise the hook
  // order changes when a range has no data.
  const gradientId = useId().replace(/[:]/g, '');
  const { ref, width } = useChartWidth();
  if (data.length === 0 || data.every((point) => point.value === 0)) {
    return <ChartEmpty message={`No ${unit} recorded for this range.`} />;
  }

  const padding = { top: 14, right: 10, bottom: 26, left: 10 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;
  const max = Math.max(...data.map((point) => point.value), 1);
  const x = (index: number) =>
    padding.left + (data.length === 1 ? plotW / 2 : (index / (data.length - 1)) * plotW);
  const y = (value: number) => padding.top + plotH - (value / max) * plotH;

  const line = data.map((point, index) => `${index === 0 ? 'M' : 'L'}${x(index)},${y(point.value)}`).join(' ');
  const area = `${line} L${x(data.length - 1)},${padding.top + plotH} L${x(0)},${padding.top + plotH} Z`;
  const labels = labelIndices(data.length, Math.max(1, Math.ceil(data.length / 6)));

  return (
    <div ref={ref} className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        role="img"
        aria-label={chartDescription(data, unit, valueFormat)}
      >
        <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity="0.28" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </linearGradient>
      </defs>

      {[0.25, 0.5, 0.75, 1].map((step) => (
        <line
          key={step}
          x1={padding.left}
          x2={width - padding.right}
          y1={padding.top + plotH - plotH * step}
          y2={padding.top + plotH - plotH * step}
          stroke={AXIS}
          strokeWidth="1"
        />
      ))}
      <text x={padding.left} y={10} fontSize="11" fill="var(--color-ink-muted)">
        peak {valueFormat(max)}
      </text>

      <path d={area} fill={`url(#${gradientId})`} />
      <path d={line} fill="none" stroke={accent} strokeWidth="2" strokeLinejoin="round" />

      {data.map((point, index) => (
        <g key={`${point.label}-${index}`}>
          <circle cx={x(index)} cy={y(point.value)} r={data.length > 45 ? 1.6 : 3} fill={accent}>
            <title>{`${point.label}: ${valueFormat(point.value)} ${unit}`}</title>
          </circle>
          {labels.has(index) && (
            <text
              x={x(index)}
              y={height - 8}
              textAnchor={index === 0 ? 'start' : index === data.length - 1 ? 'end' : 'middle'}
              fontSize="11"
              fill={MUTED}
            >
              {point.label}
            </text>
          )}
        </g>
      ))}
    </svg>
    </div>
  );
}

export function BarsChart({
  data,
  unit,
  valueFormat = (value) => numberFormat.format(value),
  height = 170,
  accent = BRAND,
}: ChartProps) {
  const { ref, width } = useChartWidth();
  if (data.length === 0 || data.every((point) => point.value === 0)) {
    return <ChartEmpty message={`No ${unit} recorded for this range.`} />;
  }

  const padding = { top: 14, right: 10, bottom: 26, left: 10 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;
  const max = Math.max(...data.map((point) => point.value), 1);
  const slot = plotW / data.length;
  const barWidth = Math.max(3, Math.min(26, slot * 0.55));
  const labels = labelIndices(data.length, Math.max(1, Math.ceil(data.length / 6)));

  return (
    <div ref={ref} className="w-full">
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      role="img"
      aria-label={chartDescription(data, unit, valueFormat)}
    >
      {[0.25, 0.5, 0.75, 1].map((step) => (
        <line
          key={step}
          x1={padding.left}
          x2={width - padding.right}
          y1={padding.top + plotH - plotH * step}
          y2={padding.top + plotH - plotH * step}
          stroke={AXIS}
          strokeWidth="1"
        />
      ))}
      <text x={padding.left} y={10} fontSize="11" fill="var(--color-ink-muted)">
        peak {valueFormat(max)}
      </text>

      {data.map((point, index) => {
        const barHeight = Math.max(2, (point.value / max) * plotH);
        const cx = padding.left + slot * index + slot / 2;
        return (
          <g key={`${point.label}-${index}`}>
            <rect
              x={cx - barWidth / 2}
              y={padding.top + plotH - barHeight}
              width={barWidth}
              height={barHeight}
              rx={Math.min(4, barWidth / 2)}
              fill={accent}
              fillOpacity={index === data.length - 1 ? 1 : 0.5}
            >
              <title>{`${point.label}: ${valueFormat(point.value)} ${unit}`}</title>
            </rect>
            {labels.has(index) && (
              <text
                x={cx}
                y={height - 8}
                textAnchor={index === 0 ? 'start' : index === data.length - 1 ? 'end' : 'middle'}
                fontSize="11"
                fill={MUTED}
              >
                {point.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
    </div>
  );
}

export interface DonutDatum {
  label: string;
  value: number;
  color: string;
}

export function DonutChart({ data, totalLabel }: { data: DonutDatum[]; totalLabel: string }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  if (total === 0) return <ChartEmpty message="No connector usage in this range." />;

  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <svg
        viewBox="0 0 140 140"
        className="h-[140px] w-[140px] shrink-0"
        role="img"
        aria-label={`Connector usage: ${data
          .map((item) => `${item.label} ${item.value} sessions`)
          .join(', ')}.`}
      >
        <circle cx="70" cy="70" r={radius} fill="none" stroke="var(--color-surface-muted)" strokeWidth="16" />
        {data.map((item) => {
          const length = (item.value / total) * circumference;
          const dash = `${Math.max(length - 3, 0)} ${circumference - Math.max(length - 3, 0)}`;
          const element = (
            <circle
              key={item.label}
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke={item.color}
              strokeWidth="16"
              strokeDasharray={dash}
              strokeDashoffset={-offset}
              transform="rotate(-90 70 70)"
              strokeLinecap="round"
            >
              <title>{`${item.label}: ${item.value} sessions`}</title>
            </circle>
          );
          offset += length;
          return element;
        })}
        <text x="70" y="66" textAnchor="middle" fontSize="20" fill="var(--color-ink)" fontFamily="var(--font-display)">
          {total}
        </text>
        <text x="70" y="84" textAnchor="middle" fontSize="9" fill={MUTED} letterSpacing="1.2">
          {totalLabel.toUpperCase()}
        </text>
      </svg>

      <ul className="w-full space-y-2">
        {data.map((item) => (
          <li key={item.label} className="flex items-center justify-between gap-3 text-xs">
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: item.color }}
                aria-hidden="true"
              />
              <span className="truncate text-ink-muted">{item.label}</span>
            </span>
            <span className="shrink-0 font-medium text-ink">
              {item.value}
              <span className="ml-1 text-ink-subtle">
                ({Math.round((item.value / total) * 100)}%)
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
