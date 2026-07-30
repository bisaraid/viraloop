'use client';

import { Scene } from '@/lib/types';
import StatusMessage from '@/components/StatusMessage';

interface ScriptResultProps {
  scenes: Scene[];
  failedSegment: number | null;
  fullNarration: string;
  copied: boolean;
  textAreaRef: React.RefObject<HTMLTextAreaElement>;
  onCopyText: () => void;
}

export default function ScriptResult({
  scenes,
  failedSegment,
  fullNarration,
  copied,
  textAreaRef,
  onCopyText,
}: ScriptResultProps) {
  const wordCount = scenes.reduce((sum, s) => sum + s.narration.split(/\s+/).length, 0);

  return (
    <div className="space-y-4">
      {/* Header hasil */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {failedSegment ? '⚠️ Script Tidak Lengkap' : '✅ Script Selesai!'}
        </h2>
        <span className="text-sm text-[var(--muted-foreground)]">
          {scenes.length} scene · ~{wordCount} kata
        </span>
      </div>

      {failedSegment && (
        <div className="card">
          <StatusMessage variant="warning">
            Script berhenti di bagian {failedSegment}. Klik Generate lagi untuk mencoba ulang.
          </StatusMessage>
        </div>
      )}

      {/* === BLOK TEKS COPYABLE === */}
      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <label className="label mb-0">Full Narasi (copyable)</label>
          <button onClick={onCopyText} className="text-sm text-[var(--primary)] hover:underline">
            {copied ? '✅ Tercopy!' : '📋 Copy to Clipboard'}
          </button>
        </div>
        <textarea
          ref={textAreaRef}
          className="textarea-field font-mono text-xs leading-relaxed"
          rows={8}
          value={fullNarration}
          readOnly
          onClick={(e) => (e.target as HTMLTextAreaElement).select()}
        />
      </div>
    </div>
  );
}