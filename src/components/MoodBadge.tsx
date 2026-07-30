'use client';

interface MoodBadgeProps {
  mood: string;
}

function getMoodBadgeColor(mood: string): string {
  const colors: Record<string, string> = {
    mencekam: '#ef4444', gelap: '#1e293b', misterius: '#8b5cf6',
    intens: '#f97316', shock: '#dc2626', sunyi: '#64748b',
    lega: '#22c55e', fakta: '#3b82f6', terang: '#eab308',
    hangat: '#f59e0b', sedih: '#6366f1', rindu: '#ec4899',
    netral: '#888', semangat: '#f97316', reflektif: '#a855f7',
  };
  return colors[mood] || '#888';
}

export default function MoodBadge({ mood }: MoodBadgeProps) {
  return (
    <span
      className="text-xs px-2 py-0.5 rounded"
      style={{
        backgroundColor: getMoodBadgeColor(mood) + '33',
        color: getMoodBadgeColor(mood),
      }}
    >
      {mood}
    </span>
  );
}