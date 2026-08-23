import { useState } from "react";

import { MAX_RADIUS_M, MIN_RADIUS_M, RADIUS_OPTIONS } from "@/lib/geo";

const PRESETS = RADIUS_OPTIONS.map((o) => o.value) as readonly number[];

/** Preset room sizes plus a manual metre entry. */
export function RadiusPicker({
  value,
  onChange,
  disabled,
  id = "radius",
}: {
  value: number;
  onChange: (m: number) => void;
  disabled?: boolean;
  id?: string;
}) {
  const [custom, setCustom] = useState(!PRESETS.includes(value));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        id={id}
        value={custom ? "custom" : value}
        disabled={disabled}
        onChange={(e) => {
          if (e.target.value === "custom") {
            setCustom(true);
            return;
          }
          setCustom(false);
          onChange(Number(e.target.value));
        }}
        className="rounded-md border border-input bg-background px-2 py-1.5 text-xs disabled:opacity-60"
      >
        {RADIUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
        <option value="custom">Custom distance…</option>
      </select>

      {custom && (
        <span className="flex items-center gap-1.5">
          <input
            type="number"
            min={MIN_RADIUS_M}
            max={MAX_RADIUS_M}
            value={value}
            disabled={disabled}
            aria-label="Custom distance in metres"
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n)) onChange(Math.min(MAX_RADIUS_M, Math.max(MIN_RADIUS_M, Math.round(n))));
            }}
            className="w-20 rounded-md border border-input bg-background px-2 py-1.5 text-xs"
          />
          <span className="text-xs text-muted-foreground">m ({MIN_RADIUS_M}–{MAX_RADIUS_M})</span>
        </span>
      )}
    </div>
  );
}
