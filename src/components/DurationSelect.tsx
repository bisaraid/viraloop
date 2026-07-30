'use client';

import { DurationTier } from '@/lib/types';
import { durationOptions, affiliateDurationConfigs } from '@/lib/duration';

interface DurationSelectProps {
  duration: DurationTier | '';
  hasResult: boolean;
  category: string;
  onDurationChange: (value: DurationTier) => void;
}

export default function DurationSelect({ duration, hasResult, category, onDurationChange }: DurationSelectProps) {
  const isAffiliate = category === 'affiliate';
  const options = isAffiliate ? Object.values(affiliateDurationConfigs) : durationOptions;

  return (
    <div>
      <label className="label">Durasi Konten</label>
      <select className="select-field" value={duration}
        disabled={hasResult}
        onChange={(e) => onDurationChange(e.target.value as DurationTier)}>
        <option value="">— Pilih Durasi —</option>
        {options.map((d) => (
          <option key={d.id} value={d.id}>{d.label}</option>
        ))}
      </select>
      {duration && (
        <p className="text-xs text-[var(--muted-foreground)] mt-1">
          {options.find(d => d.id === duration)?.description}
        </p>
      )}
    </div>
  );
}