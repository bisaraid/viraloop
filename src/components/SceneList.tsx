'use client';

import { Scene } from '@/lib/types';
import MoodBadge from '@/components/MoodBadge';

interface SceneListProps {
  scenes: Scene[];
  expandedScene: number | null;
  onToggleExpand: (index: number) => void;
}

export default function SceneList({ scenes, expandedScene, onToggleExpand }: SceneListProps) {
  return (
    <div className="space-y-2">
      <h3 className="font-semibold">📜 Daftar Scene</h3>
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
  );
}