import { Bar, BarChart, CartesianGrid, LabelList, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartCard, EmptyState } from './ui';

// Marks follow the data-viz spec: thin bars (<= 24px) with a rounded data end, 2px lines, 8px+ end dots,
// solid hairline grid, a 2px surface gap between touching fills, text in ink tokens (never the series colour).
const INK = 'var(--foreground)';
const SURFACE = 'var(--background)';
const axisText = { fontSize: 12, fill: 'var(--muted-foreground)' };
const axis = { tickLine: false, axisLine: false, tick: axisText };

const hasData = (rows, keys) => rows?.some((r) => keys.some((k) => r[k] > 0));
const NoData = () => <EmptyState title="No data yet" message="Charts fill in as reports come in." />;

const total = (row) => (row.Lost || 0) + (row.Found || 0);

// Category axis label: one line, truncated with an ellipsis (Recharts would otherwise wrap it).
const CategoryTick = ({ x, y, payload }) => (
  <text x={x - 8} y={y} textAnchor="end" dominantBaseline="central" fontSize={12} fill="var(--muted-foreground)">
    {payload.value.length > 17 ? `${payload.value.slice(0, 16)}…` : payload.value}
  </text>
);

function Legend({ items }) {
  return (
    <ul className="flex shrink-0 gap-4 text-xs text-muted-foreground" aria-label="Legend">
      {items.map(([name, color]) => (
        <li key={name} className="flex items-center gap-1.5"><span aria-hidden className="size-2 rounded-[2px]" style={{ background: color }} />{name}</li>
      ))}
    </ul>
  );
}
const ENTITY_LEGEND = [['Lost', 'var(--lost)'], ['Found', 'var(--found)']];

// Values lead, labels follow; series keyed with a short line, not a box.
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-background px-3 py-2 text-xs shadow-md">
      <p className="mb-1.5 text-muted-foreground">{label ?? payload[0].payload.name}</p>
      <ul className="space-y-1">
        {payload.map((p) => (
          <li key={p.dataKey} className="flex items-center gap-2">
            <span aria-hidden className="h-0.5 w-3 rounded-full" style={{ background: p.color || p.fill || p.stroke }} />
            <span className="font-medium tabular-nums">{p.value}</span>
            <span className="text-muted-foreground">{p.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Every chart has a screen-reader table twin, so no value is gated behind hover.
function DataTable({ caption, columns, rows }) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead><tr>{columns.map((c) => <th key={c} scope="col">{c}</th>)}</tr></thead>
      <tbody>{rows.map((r) => <tr key={r[0]}>{r.map((v, i) => <td key={i}>{v}</td>)}</tr>)}</tbody>
    </table>
  );
}

const tipLabel = (rows, valueOf) => ({ x, y, width, height, index }) => (
  <text x={x + width + 8} y={y + height / 2} dominantBaseline="central" fontSize={12} fill="var(--muted-foreground)" className="tabular-nums">{valueOf(rows[index])}</text>
);

export function LostFoundChart({ data }) {
  return (
    <ChartCard title="Lost vs Found" subtitle="Reports in the selected period" legend={<Legend items={ENTITY_LEGEND} />}>
      {hasData(data, ['Lost', 'Found']) ? (
        <>
          <ResponsiveContainer>
            <BarChart data={data} barGap={2} barCategoryGap="28%">
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="label" interval="preserveStartEnd" minTickGap={14} {...axis} />
              <YAxis allowDecimals={false} width={28} {...axis} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.6 }} />
              <Bar dataKey="Lost" fill="var(--lost)" radius={[4, 4, 0, 0]} maxBarSize={20} />
              <Bar dataKey="Found" fill="var(--found)" radius={[4, 4, 0, 0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
          <DataTable caption="Lost and found reports in the selected period" columns={['Period', 'Lost', 'Found']} rows={data.map((d) => [d.label, d.Lost, d.Found])} />
        </>
      ) : <NoData />}
    </ChartCard>
  );
}

// Horizontal stacked bars: Lost + Found per row, total at the tip.
function StackedBars({ title, subtitle, rows, caption, nameHeader }) {
  return (
    <ChartCard title={title} subtitle={subtitle} legend={<Legend items={ENTITY_LEGEND} />}>
      {rows?.length ? (
        <>
          <ResponsiveContainer>
            <BarChart data={rows} layout="vertical" margin={{ left: 0, right: 28 }} barCategoryGap={8}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={124} interval={0} tickLine={false} axisLine={false} tick={<CategoryTick />} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.6 }} />
              <Bar dataKey="Lost" stackId="a" fill="var(--lost)" stroke={SURFACE} strokeWidth={2} barSize={16} />
              <Bar dataKey="Found" stackId="a" fill="var(--found)" stroke={SURFACE} strokeWidth={2} radius={[0, 4, 4, 0]} barSize={16}>
                <LabelList content={tipLabel(rows, total)} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <DataTable caption={caption} columns={[nameHeader, 'Lost', 'Found']} rows={rows.map((r) => [r.name, r.Lost, r.Found])} />
        </>
      ) : <NoData />}
    </ChartCard>
  );
}

export const CategoryChart = ({ data }) => (
  <StackedBars title="Items by category" subtitle="Lost and found" rows={data} caption="Reports by category" nameHeader="Category" />
);
export const LocationChart = ({ data }) => (
  <StackedBars title="Items by location" subtitle="Top campus hotspots" rows={data} caption="Reports by location" nameHeader="Location" />
);

export function RecoveryChart({ data, range = 'all' }) {
  const last = data?.length - 1;
  return (
    <ChartCard title={range === 'all' ? 'Monthly recovery trend' : 'Recovery trend'} subtitle="Items returned to owners in the selected period">
      {hasData(data, ['Recovered']) ? (
        <>
          <ResponsiveContainer>
            <LineChart data={data} margin={{ right: 16, top: 8 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="label" interval="preserveStartEnd" minTickGap={14} {...axis} />
              <YAxis allowDecimals={false} width={28} {...axis} />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--input)' }} />
              <Line type="monotone" dataKey="Recovered" stroke={INK} strokeWidth={2} strokeLinecap="round"
                dot={{ r: 4, fill: INK, stroke: SURFACE, strokeWidth: 2 }} activeDot={{ r: 5, fill: INK, stroke: SURFACE, strokeWidth: 2 }}>
                <LabelList dataKey="Recovered" position="top" offset={10} content={({ x, y, value, index }) => index === last && (
                  <text x={x} y={y - 12} textAnchor="middle" fontSize={12} fontWeight={500} fill={INK}>{value}</text>
                )} />
              </Line>
            </LineChart>
          </ResponsiveContainer>
          <DataTable caption="Items recovered in the selected period" columns={['Period', 'Recovered']} rows={data.map((d) => [d.label, d.Recovered])} />
        </>
      ) : <NoData />}
    </ChartCard>
  );
}

// One series of nominal categories: one colour (ink) for every bar, sorted, value at the tip.
export function ClaimStatusChart({ data, className }) {
  const rows = [...(data || [])].sort((a, b) => b.value - a.value);
  return (
    <ChartCard title="Claim status" subtitle="All claims" className={className}>
      {rows.length ? (
        <>
          <ResponsiveContainer>
            <BarChart data={rows} layout="vertical" margin={{ left: 0, right: 28 }} barCategoryGap={8}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={124} interval={0} tickLine={false} axisLine={false} tick={<CategoryTick />} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.6 }} />
              <Bar dataKey="value" name="Claims" fill={INK} radius={[0, 4, 4, 0]} barSize={16}>
                <LabelList content={tipLabel(rows, (r) => r.value)} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <DataTable caption="Claims by status" columns={['Status', 'Claims']} rows={rows.map((r) => [r.name, r.value])} />
        </>
      ) : <NoData />}
    </ChartCard>
  );
}
