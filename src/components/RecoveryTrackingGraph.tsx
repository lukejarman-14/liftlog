import { Activity, Heart, Moon, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { DailyReadiness } from '../types';
import { Card } from './ui/Card';

interface RecoveryTrackingGraphProps {
  entries: DailyReadiness[];
}

type TimePeriod = '7d' | '1m' | '1y' | 'ytd';
type SleepType = 'total' | 'deep' | 'rem' | 'awake';

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatShortDate(date: string): string {
  return new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function hasRecoveryMetric(entry: DailyReadiness): boolean {
  return entry.sleepHours != null || entry.hrvMs != null || entry.restingHr != null;
}

function avg(values: (number | undefined)[]): number | undefined {
  const nums = values.filter((v): v is number => v != null);
  if (nums.length === 0) return undefined;
  return nums.reduce((s, v) => s + v, 0) / nums.length;
}

// Dynamic Y-axis: centres data with 25% padding either side
function calcDomain(values: (number | undefined)[], minRange = 1): [number, number] {
  const nums = values.filter((v): v is number => v != null);
  if (nums.length === 0) return [0, 10];
  const lo = Math.min(...nums);
  const hi = Math.max(...nums);
  const range = Math.max(hi - lo, minRange);
  const pad = range * 0.25;
  return [Math.floor(lo - pad), Math.ceil(hi + pad)];
}

function getCutoff(period: TimePeriod): string {
  const now = new Date();
  if (period === '7d') { now.setDate(now.getDate() - 7); return toDateStr(now); }
  if (period === '1m') { now.setMonth(now.getMonth() - 1); return toDateStr(now); }
  if (period === '1y') { now.setFullYear(now.getFullYear() - 1); return toDateStr(now); }
  return `${new Date().getFullYear()}-01-01`;
}

function getPrevRange(period: TimePeriod): [string, string] {
  const now = new Date();
  if (period === '7d') {
    const e = new Date(now); e.setDate(now.getDate() - 7);
    const s = new Date(now); s.setDate(now.getDate() - 14);
    return [toDateStr(s), toDateStr(e)];
  }
  if (period === '1m') {
    const e = new Date(now); e.setMonth(now.getMonth() - 1);
    const s = new Date(now); s.setMonth(now.getMonth() - 2);
    return [toDateStr(s), toDateStr(e)];
  }
  if (period === '1y') {
    const e = new Date(now); e.setFullYear(now.getFullYear() - 1);
    const s = new Date(now); s.setFullYear(now.getFullYear() - 2);
    return [toDateStr(s), toDateStr(e)];
  }
  const y = now.getFullYear();
  return [`${y - 1}-01-01`, `${y}-01-01`];
}

function prevLabel(period: TimePeriod): string {
  if (period === '7d') return 'prev 7d';
  if (period === '1m') return 'prev month';
  if (period === '1y') return 'prev year';
  return 'last year';
}

interface AvgChange { delta: number; pct: number; isGood: boolean; period: TimePeriod }

function buildChange(
  curr: (number | undefined)[],
  prev: (number | undefined)[],
  lowerIsBetter: boolean,
  period: TimePeriod,
): AvgChange | undefined {
  const c = avg(curr); const p = avg(prev);
  if (c == null || p == null || p === 0) return undefined;
  const delta = c - p;
  const pct = (delta / p) * 100;
  if (Math.abs(pct) < 0.5) return undefined;
  return { delta, pct, isGood: lowerIsBetter ? delta < 0 : delta > 0, period };
}

function ChangeBadge({ change }: { change: AvgChange }) {
  const sign = change.pct > 0 ? '+' : '';
  return (
    <span className={`text-[11px] font-semibold ${change.isGood ? 'text-emerald-600' : 'text-red-500'}`}>
      {change.delta > 0 ? '↑' : '↓'} {sign}{change.pct.toFixed(1)}% vs {prevLabel(change.period)}
    </span>
  );
}

function formatSleepDuration(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  return `${hours.toFixed(1)} h`;
}

function PeriodSelector({ period, onChange }: { period: TimePeriod; onChange: (p: TimePeriod) => void }) {
  return (
    <div className="flex gap-1.5 pt-3 mt-3 border-t border-gray-50">
      {(['7d', '1m', '1y', 'ytd'] as const).map(p => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
            period === p ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-500'
          }`}
        >
          {p === '7d' ? '7 days' : p === '1m' ? '1 month' : p === '1y' ? '1 year' : 'YTD'}
        </button>
      ))}
    </div>
  );
}

// ─── Sleep chart ─────────────────────────────────────────────────────────────

const SLEEP_TYPES: { key: SleepType; label: string; color: string }[] = [
  { key: 'total', label: 'Total',  color: '#8b5cf6' },
  { key: 'deep',  label: 'Deep',   color: '#3b82f6' },
  { key: 'rem',   label: 'REM',    color: '#10b981' },
  { key: 'awake', label: 'Awake',  color: '#f59e0b' },
];

function getSleepValue(e: DailyReadiness, type: SleepType): number | undefined {
  if (type === 'total') return e.sleepHours;
  if (type === 'deep')  return e.deepSleepHours;
  if (type === 'rem')   return e.remSleepHours;
  return e.awakeHours;
}

function SleepChart({ all }: { all: DailyReadiness[] }) {
  const [period, setPeriod] = useState<TimePeriod>('1m');
  const [sleepType, setSleepType] = useState<SleepType>('total');

  const cutoff = getCutoff(period);
  const [prevStart, prevEnd] = getPrevRange(period);
  const meta = SLEEP_TYPES.find(s => s.key === sleepType)!;

  const filtered = all.filter(e => e.date >= cutoff);
  const prevFiltered = all.filter(e => e.date >= prevStart && e.date < prevEnd);

  const data = filtered
    .map(e => ({ chartLabel: formatShortDate(e.date), value: getSleepValue(e, sleepType) }))
    .filter(d => d.value != null);

  const avgVal = avg(data.map(d => d.value));
  const change = buildChange(
    filtered.map(e => getSleepValue(e, sleepType)),
    prevFiltered.map(e => getSleepValue(e, sleepType)),
    false, period,
  );
  const domain = calcDomain(data.map(d => d.value), sleepType === 'total' ? 1 : 0.5);
  const dateRange = filtered.length >= 2
    ? `${formatShortDate(filtered[0].date)} – ${formatShortDate(filtered[filtered.length - 1].date)}`
    : filtered.length === 1 ? formatShortDate(filtered[0].date) : null;

  return (
    <Card className="p-4 mb-4 border-gray-100">
      {/* Sleep type selector */}
      <div className="flex gap-1.5 mb-3">
        {SLEEP_TYPES.map(({ key, label, color }) => (
          <button
            key={key}
            onClick={() => setSleepType(key)}
            className="px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors"
            style={sleepType === key
              ? { backgroundColor: color, color: '#fff' }
              : { backgroundColor: '#f3f4f6', color: '#6b7280' }
            }
          >
            {label}
          </button>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-1">
        <div>
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <Moon size={14} className="text-violet-500" />
            Sleep · {meta.label}
          </h3>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {avgVal != null && <span className="text-xs text-gray-400">Avg {formatSleepDuration(avgVal)}</span>}
            {change && <ChangeBadge change={change} />}
          </div>
        </div>
        {dateRange && <span className="text-[11px] text-gray-400 flex-shrink-0">{dateRange}</span>}
      </div>

      {/* Chart */}
      {data.length < 2 ? (
        <p className="text-xs text-gray-400 text-center py-8">Not enough {meta.label.toLowerCase()} data for this period</p>
      ) : (
        <div className="h-48 mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 6, right: 0, bottom: 0, left: -24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="chartLabel" tick={{ fontSize: 10 }} />
              <YAxis domain={domain} tick={{ fontSize: 10 }} tickFormatter={(v: number) => v < 1 ? `${Math.round(v * 60)}m` : `${v.toFixed(1)}`} />
              {avgVal != null && (
                <ReferenceLine y={avgVal} stroke={meta.color} strokeDasharray="5 3" strokeOpacity={0.5} />
              )}
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 10, borderColor: '#e5e7eb' }}
                formatter={(v: unknown) => [formatSleepDuration(v as number), meta.label]}
                labelFormatter={(l: string) => l}
              />
              <Line type="monotone" dataKey="value" name={meta.label}
                stroke={meta.color} strokeWidth={2} dot={{ r: 3 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <PeriodSelector period={period} onChange={setPeriod} />
    </Card>
  );
}

// ─── HRV chart ───────────────────────────────────────────────────────────────

function HrvChart({ all }: { all: DailyReadiness[] }) {
  const [period, setPeriod] = useState<TimePeriod>('1m');

  const cutoff = getCutoff(period);
  const [prevStart, prevEnd] = getPrevRange(period);

  const filtered = all.filter(e => e.date >= cutoff && e.hrvMs != null);
  const prevFiltered = all.filter(e => e.date >= prevStart && e.date < prevEnd && e.hrvMs != null);

  const data = filtered.map(e => ({ chartLabel: formatShortDate(e.date), value: e.hrvMs }));
  const avgVal = avg(data.map(d => d.value));
  const latest = data[data.length - 1]?.value;
  const change = buildChange(
    filtered.map(e => e.hrvMs), prevFiltered.map(e => e.hrvMs),
    false, period,
  );
  const domain = calcDomain(data.map(d => d.value), 10);
  const dateRange = filtered.length >= 2
    ? `${formatShortDate(filtered[0].date)} – ${formatShortDate(filtered[filtered.length - 1].date)}`
    : filtered.length === 1 ? formatShortDate(filtered[0].date) : null;

  return (
    <Card className="p-4 mb-4 border-gray-100">
      <div className="flex items-start justify-between mb-1">
        <div>
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp size={14} className="text-emerald-500" />
            Heart Rate Variability
          </h3>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {avgVal != null && <span className="text-xs text-gray-400">Avg {Math.round(avgVal)} ms</span>}
            {change && <ChangeBadge change={change} />}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          {latest != null && <p className="text-sm font-bold text-gray-700">{Math.round(latest)} ms</p>}
          {dateRange && <p className="text-[11px] text-gray-400">{dateRange}</p>}
        </div>
      </div>

      {data.length < 2 ? (
        <p className="text-xs text-gray-400 text-center py-8">Not enough HRV data for this period</p>
      ) : (
        <div className="h-44 mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 6, right: 0, bottom: 0, left: -24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="chartLabel" tick={{ fontSize: 10 }} />
              <YAxis domain={domain} tick={{ fontSize: 10 }} />
              {avgVal != null && (
                <ReferenceLine y={avgVal} stroke="#10b981" strokeDasharray="5 3" strokeOpacity={0.5} />
              )}
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 10, borderColor: '#e5e7eb' }}
                formatter={(v: unknown) => [`${Math.round(v as number)} ms`, 'HRV']}
                labelFormatter={(l: string) => l}
              />
              <Line type="monotone" dataKey="value" name="HRV" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <PeriodSelector period={period} onChange={setPeriod} />
    </Card>
  );
}

// ─── Resting HR chart ────────────────────────────────────────────────────────

function RestingHrChart({ all }: { all: DailyReadiness[] }) {
  const [period, setPeriod] = useState<TimePeriod>('1m');

  const cutoff = getCutoff(period);
  const [prevStart, prevEnd] = getPrevRange(period);

  const filtered = all.filter(e => e.date >= cutoff && e.restingHr != null);
  const prevFiltered = all.filter(e => e.date >= prevStart && e.date < prevEnd && e.restingHr != null);

  const data = filtered.map(e => ({ chartLabel: formatShortDate(e.date), value: e.restingHr }));
  const avgVal = avg(data.map(d => d.value));
  const latest = data[data.length - 1]?.value;
  const change = buildChange(
    filtered.map(e => e.restingHr), prevFiltered.map(e => e.restingHr),
    true, period,
  );
  const domain = calcDomain(data.map(d => d.value), 5);
  const dateRange = filtered.length >= 2
    ? `${formatShortDate(filtered[0].date)} – ${formatShortDate(filtered[filtered.length - 1].date)}`
    : filtered.length === 1 ? formatShortDate(filtered[0].date) : null;

  return (
    <Card className="p-4 mb-4 border-gray-100">
      <div className="flex items-start justify-between mb-1">
        <div>
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <Heart size={14} className="text-red-500" />
            Resting Heart Rate
          </h3>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {avgVal != null && <span className="text-xs text-gray-400">Avg {Math.round(avgVal)} bpm</span>}
            {change && <ChangeBadge change={change} />}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          {latest != null && <p className="text-sm font-bold text-gray-700">{Math.round(latest)} bpm</p>}
          {dateRange && <p className="text-[11px] text-gray-400">{dateRange}</p>}
        </div>
      </div>

      {data.length < 2 ? (
        <p className="text-xs text-gray-400 text-center py-8">Not enough resting HR data for this period</p>
      ) : (
        <div className="h-44 mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 6, right: 0, bottom: 0, left: -24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="chartLabel" tick={{ fontSize: 10 }} />
              <YAxis domain={domain} tick={{ fontSize: 10 }} />
              {avgVal != null && (
                <ReferenceLine y={avgVal} stroke="#ef4444" strokeDasharray="5 3" strokeOpacity={0.5} />
              )}
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 10, borderColor: '#e5e7eb' }}
                formatter={(v: unknown) => [`${Math.round(v as number)} bpm`, 'Resting HR']}
                labelFormatter={(l: string) => l}
              />
              <Line type="monotone" dataKey="value" name="Rest HR" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <PeriodSelector period={period} onChange={setPeriod} />
    </Card>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export function RecoveryTrackingGraph({ entries }: RecoveryTrackingGraphProps) {
  const all = entries
    .filter(hasRecoveryMetric)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (all.length === 0) {
    return (
      <Card className="p-4 mb-5 border-gray-100">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
            <Activity size={18} className="text-gray-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-800">Recovery tracking</p>
            <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
              Add sleep hours, HRV, and resting heart rate in Daily Readiness to see trends here.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div>
      <SleepChart all={all} />
      <HrvChart all={all} />
      <RestingHrChart all={all} />
    </div>
  );
}
