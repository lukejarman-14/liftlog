import { useRef, useEffect } from 'react';

export interface WheelOption {
  value: string;
  label: string;
}

interface WheelPickerProps {
  options: WheelOption[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
}

const ITEM_HEIGHT = 36;   // px per row
const VISIBLE = 5;        // rows shown (odd → one centred)
const PAD = ((VISIBLE - 1) / 2) * ITEM_HEIGHT;

/**
 * Inline iOS-style scroll-wheel. Renders directly in the page (no native popup):
 * a snap-scrolling column with a highlighted centre band and faded top/bottom edges.
 * The option centred under the band is the selected value.
 */
export function WheelPicker({ options, value, onChange, ariaLabel }: WheelPickerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout>>();

  // Position the wheel on the current value when first shown.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const idx = Math.max(0, options.findIndex(o => o.value === value));
    el.scrollTop = idx * ITEM_HEIGHT;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      const idx = Math.min(
        options.length - 1,
        Math.max(0, Math.round(el.scrollTop / ITEM_HEIGHT)),
      );
      const opt = options[idx];
      if (opt && opt.value !== value) onChange(opt.value);
    }, 90);
  };

  return (
    <div
      className="relative"
      style={{ height: VISIBLE * ITEM_HEIGHT }}
      role="listbox"
      aria-label={ariaLabel}
    >
      {/* Centre selection band */}
      <div
        className="pointer-events-none absolute inset-x-0 z-10 border-y border-gray-200 bg-gray-50/40"
        style={{ top: PAD, height: ITEM_HEIGHT }}
      />
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto [&::-webkit-scrollbar]:hidden"
        style={{
          scrollSnapType: 'y mandatory',
          scrollbarWidth: 'none',
          WebkitMaskImage:
            'linear-gradient(to bottom, transparent, #000 28%, #000 72%, transparent)',
          maskImage:
            'linear-gradient(to bottom, transparent, #000 28%, #000 72%, transparent)',
        }}
      >
        <div style={{ paddingTop: PAD, paddingBottom: PAD }}>
          {options.map(opt => (
            <div
              key={opt.value || 'blank'}
              onClick={() => onChange(opt.value)}
              className={`flex items-center justify-center transition-colors ${
                opt.value === value ? 'text-gray-900 font-semibold' : 'text-gray-400'
              }`}
              style={{ height: ITEM_HEIGHT, scrollSnapAlign: 'center', fontSize: '16px' }}
            >
              {opt.label || '–'}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
