import { useRef, useState, useLayoutEffect, useEffect, useCallback } from 'react';

const ITEM_H = 44;
const VISIBLE = 5;
const PAD = Math.floor(VISIBLE / 2); // 2 items of padding each side

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const currentYear = new Date().getFullYear();

export const DAYS   = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));
export const MONTHS_VALUES = MONTHS.map((label, i) => ({ value: String(i + 1).padStart(2, '0'), label }));
export const YEARS  = Array.from({ length: currentYear - 1930 + 1 }, (_, i) => String(currentYear - i));

type Item = { value: string; label: string };

interface WheelColumnProps {
  items: Item[];
  value: string;
  onChange: (v: string) => void;
  onInteract?: () => void;   // fired on genuine user interaction (not the mount scroll)
  label: string;
}

function WheelColumn({ items, value, onChange, onInteract, label }: WheelColumnProps) {
  const ref = useRef<HTMLDivElement>(null);
  const tidRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idx = Math.max(0, items.findIndex(i => i.value === value));
  const [liveIdx, setLiveIdx] = useState(idx);

  // Scroll to selected item when value is set externally (including on mount)
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTop = idx * ITEM_H;
    setLiveIdx(idx);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleScroll = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const raw = Math.round(el.scrollTop / ITEM_H);
    setLiveIdx(Math.max(0, Math.min(raw, items.length - 1)));
    if (tidRef.current) clearTimeout(tidRef.current);
    tidRef.current = setTimeout(() => {
      if (!el) return;
      const snapped = Math.max(0, Math.min(Math.round(el.scrollTop / ITEM_H), items.length - 1));
      el.scrollTop = snapped * ITEM_H;
      onChange(items[snapped].value);
    }, 120);
  }, [items, onChange]);

  return (
    <div className="flex-1 flex flex-col items-center">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">{label}</p>
      <div className="relative w-full" style={{ height: ITEM_H * VISIBLE }}>
        {/* selection highlight */}
        <div
          className="pointer-events-none absolute left-1 right-1 rounded-xl border border-brand-200 bg-orange-50"
          style={{ top: ITEM_H * PAD, height: ITEM_H }}
        />
        {/* top / bottom fade */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 rounded-t-xl"
          style={{ height: ITEM_H * PAD, background: 'linear-gradient(to bottom, white 30%, transparent)' }} />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 rounded-b-xl"
          style={{ height: ITEM_H * PAD, background: 'linear-gradient(to top, white 30%, transparent)' }} />

        <div
          ref={ref}
          onScroll={handleScroll}
          onPointerDown={onInteract}
          className="absolute inset-0 overflow-y-scroll scrollbar-none"
          style={{
            scrollSnapType: 'y mandatory',
            WebkitOverflowScrolling: 'touch',
            msOverflowStyle: 'none',
            scrollbarWidth: 'none',
          }}
        >
          <div style={{ height: ITEM_H * PAD }} />
          {items.map((item, i) => {
            const dist = Math.abs(i - liveIdx);
            return (
              <div
                key={item.value}
                style={{
                  height: ITEM_H,
                  scrollSnapAlign: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: dist === 0 ? '17px' : '15px',
                  fontWeight: dist === 0 ? 600 : 400,
                  color: dist === 0 ? '#111827' : '#9ca3af',
                  opacity: dist <= 1 ? 1 : dist === 2 ? 0.5 : 0.2,
                  transition: 'color 0.1s, font-size 0.1s, opacity 0.1s',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
                onClick={() => {
                  onInteract?.();
                  ref.current?.scrollTo({ top: i * ITEM_H, behavior: 'smooth' });
                  onChange(item.value);
                }}
              >
                {item.label}
              </div>
            );
          })}
          <div style={{ height: ITEM_H * PAD }} />
        </div>
      </div>
    </div>
  );
}

interface DateScrollPickerProps {
  day: string;
  month: string;
  year: string;
  onDayChange: (v: string) => void;
  onMonthChange: (v: string) => void;
  onYearChange: (v: string) => void;
  onInteract?: () => void;   // fired the first time the user actually touches the picker
}

export default function DateScrollPicker({
  day, month, year, onDayChange, onMonthChange, onYearChange, onInteract,
}: DateScrollPickerProps) {
  // Clamp the day column to the days that actually exist in the selected
  // month/year so impossible dates (e.g. 31 Feb) can't be picked.
  const daysInMonth = new Date(Number(year), Number(month), 0).getDate() || 31;
  const dayItems: Item[] = Array.from({ length: daysInMonth }, (_, i) => {
    const d = String(i + 1).padStart(2, '0');
    return { value: d, label: d };
  });
  const yearItems: Item[] = YEARS.map(y => ({ value: y, label: y }));

  // If the selected day no longer exists in the chosen month (e.g. was 31, then
  // the user switches to Feb), clamp it down to the last valid day.
  useEffect(() => {
    if (Number(day) > daysInMonth) onDayChange(String(daysInMonth).padStart(2, '0'));
  }, [daysInMonth, day, onDayChange]);

  return (
    <div className="flex gap-2 rounded-2xl border border-gray-200 bg-white p-2">
      <WheelColumn items={dayItems}       value={day}   onChange={onDayChange}   onInteract={onInteract} label="Day"   />
      <WheelColumn items={MONTHS_VALUES}  value={month} onChange={onMonthChange} onInteract={onInteract} label="Month" />
      <WheelColumn items={yearItems}      value={year}  onChange={onYearChange}  onInteract={onInteract} label="Year"  />
    </div>
  );
}
