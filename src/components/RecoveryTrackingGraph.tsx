import { Activity, TrendingUp } from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
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

interface RecoveryPoint {
  date: string;
  label: string;
  sleepHours?: number;
  hrvMs?: number;
  restingHr?: number;
}

function formatShortDate(date: string): string {
  return new Date(date + 'T12:00:00').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
}

function hasRecoveryMetric(entry: DailyReadiness): boolean {
  return entry.sleepHours != null || entry.hrvMs != null || entry.restingHr != null;
}

function formatMetric(value: number | undefined, suffix: string, decimals = 0): string {
  if (value == null) return '-';
  return `${value.toFixed(decimals)}${suffix}`;
}

function tooltipValue(value: unknown, name: string): [string, string] {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return ['-', name];
  if (name === 'Sleep') return [`${numeric.toFixed(1)} h`, name];
  if (name === 'HRV') return [`${Math.round(numeric)} ms`, name];
  if (name === 'Rest HR') return [`${Math.round(numeric)} bpm`, name];
  return [String(value), name];
}

export function RecoveryTrackingGraph({ entries }: RecoveryTrackingGraphProps) {
  const data: RecoveryPoint[] = entries
    .filter(hasRecoveryMetric)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-21)
    .map(entry => ({
      date: entry.date,
      label: formatShortDate(entry.date),
      sleepHours: entry.sleepHours,
      hrvMs: entry.hrvMs,
      restingHr: entry.restingHr,
    }));

  const latest = data.length > 0 ? data[data.length - 1] : undefined;

  if (data.length === 0) {
    return (
      <Card className="p-4 mb-5 border-gray-100">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
            <Activity size={18} className="text-gray-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-800">Recovery tracking graph</p>
            <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
              Add sleep hours, HRV, and resting heart rate in Daily Readiness to see trends here.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 mb-5 border-gray-100">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp size={15} className="text-brand-500" />
            Recovery trends
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">Sleep, HRV, and resting HR over the last 21 logs.</p>
        </div>
        {latest && (
          <div className="text-right text-[11px] text-gray-500 leading-5 flex-shrink-0">
            <div><span className="font-bold text-gray-700">{formatMetric(latest.sleepHours, 'h', 1)}</span> sleep</div>
            <div><span className="font-bold text-gray-700">{formatMetric(latest.hrvMs, 'ms')}</span> HRV</div>
            <div><span className="font-bold text-gray-700">{formatMetric(latest.restingHr, ' bpm')}</span> RHR</div>
          </div>
        )}
      </div>

      {data.length === 1 ? (
        <p className="text-xs text-gray-400 text-center py-6">
          First recovery log saved. Add another day to draw the trend line.
        </p>
      ) : (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 6, right: 0, bottom: 0, left: -24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
              <YAxis yAxisId="sleep" orientation="right" domain={[0, 10]} tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 10, borderColor: '#e5e7eb' }}
                formatter={tooltipValue}
                labelFormatter={(label: string) => label}
              />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <Line
                yAxisId="sleep"
                type="monotone"
                dataKey="sleepHours"
                name="Sleep"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="hrvMs"
                name="HRV"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="restingHr"
                name="Rest HR"
                stroke="#ef4444"
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
