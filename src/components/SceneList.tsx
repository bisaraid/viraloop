'use client';

import { useState, useEffect } from 'react';
import { Scene } from '@/lib/types';
import MoodBadge from '@/components/MoodBadge';

interface SceneListProps {
  scenes: Scene[];
  expandedScene: number | null;
  onToggleExpand: (index: number) => void;
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`w-5 h-5 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export default function SceneList({ scenes, expandedScene, onToggleExpand }: SceneListProps) {
  const [sectionExpanded, setSectionExpanded] = useState(false);

  // Reset ke collapsed setiap kali scenes berubah (generate baru)
  useEffect(() => {
    setSectionExpanded(false);
  }, [scenes]);

  return (
    <div className="space-y-2">
      {/* Header — clickable card untuk toggle section */}
      <button
        onClick={() => setSectionExpanded(!sectionExpanded)}
        className="w-full card cursor-pointer hover:border-[var(--primary)]/50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">📜</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold">Daftar Scene</span>
              <span className="text-xs text-[var(--muted-foreground)]">({scenes.length} scene)</span>
            </div>
            {!sectionExpanded && (
              <p className="text-xs text-[var(--muted-foreground)]/70 mt-0.5">
                Klik untuk lihat detail scene & image prompt
              </p>
            )}
          </div>
          <ChevronIcon expanded={sectionExpanded} />
        </div>
      </button>

      {/* Daftar scene — hanya render saat section expanded */}
      {sectionExpanded && (
        <div className="space-y-2 animate-[fadeSlideUp_0.3s_ease-out]">
          {scenes.map((scene, i) => (
            <div key={i} className="card">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-[var(--muted-foreground)]">Scene {i + 1}</span>
                {scene.is_hook && (
                  <span className="text-xs bg-yellow-600/20 text-yellow-400 px-2 py-0.5 rounded">HOOK</span>
                )}
                <MoodBadge mood={scene.scene_mood} />
                <button onClick={() => onToggleExpand(i)}
                  className="ml-auto text-xs text-[var(--muted-foreground)]">
                  {expandedScene === i ? 'Sembunyikan' : 'Detail'}
                </button>
              </div>
              <p className="text-sm leading-relaxed">{scene.narration}</p>
              {expandedScene === i && (
                <div className="mt-2 pt-2 border-t border-[var(--border)]">
                  <p className="text-xs text-[var(--muted-foreground)]">
                    <strong>Image Prompt:</strong> {scene.image_prompt}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}