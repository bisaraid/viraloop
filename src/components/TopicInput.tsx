'use client';

import { useState, useEffect } from 'react';
import { CategoryId } from '@/lib/types';
import StatusMessage from '@/components/StatusMessage';

interface TopicInputProps {
  topic: string;
  ideaMode: 'manual' | 'trending';
  ideasList: string[];
  selectedIdea: string | null;
  isLoadingIdeas: boolean;
  trendingFailed: boolean;
  hasResult: boolean;
  category: CategoryId | '';
  nicheName: string;
  onTopicChange: (value: string) => void;
  onManualClick: () => void;
  onTrendingClick: () => void;
  onSelectIdea: (idea: string) => void;
  onNicheNameChange: (value: string) => void;
}

export default function TopicInput({
  topic,
  ideaMode,
  ideasList,
  selectedIdea,
  isLoadingIdeas,
  trendingFailed,
  hasResult,
  category,
  nicheName,
  onTopicChange,
  onManualClick,
  onTrendingClick,
  onSelectIdea,
  onNicheNameChange,
}: TopicInputProps) {
  const isAffiliate = category === 'affiliate';
  const [mobileTrendingExpanded, setMobileTrendingExpanded] = useState(true);

  // Auto-collapse on mobile when a trending idea is selected
  useEffect(() => {
    if (ideaMode === 'trending' && selectedIdea) {
      setMobileTrendingExpanded(false);
    }
  }, [selectedIdea, ideaMode]);

  const isTrendingCollapsed = ideaMode === 'trending' && selectedIdea && !mobileTrendingExpanded;

  return (
    <>
      {/* Topik / Ide — dengan toggle sumber ide untuk non-affiliate */}
      {!isAffiliate && (
        <div>
          <label className="label">Judul / Ide Topik</label>

          {/* MOBILE: collapsed bar when trending idea is selected */}
          <div className="md:hidden">
            {isTrendingCollapsed ? (
              <div className="flex items-center gap-3 p-3 rounded-xl border border-[var(--primary)] bg-[var(--primary)]/10">
                <span className="text-xl">📈</span>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold truncate block">{selectedIdea}</span>
                </div>
                <button
                  className="btn-secondary text-xs py-2 px-3 whitespace-nowrap"
                  onClick={() => setMobileTrendingExpanded(true)}
                >
                  Ganti Ide
                </button>
              </div>
            ) : (
              /* Trending section expanded — same as before */
              <>
                {/* Toggle sumber ide — disabled jika sudah ada hasil */}
                <div className="flex gap-2 mb-2">
                  <button className={`btn-secondary text-xs flex-1 py-2.5 ${ideaMode === 'manual' ? '!border-[var(--primary)]' : ''}`}
                    disabled={hasResult}
                    onClick={onManualClick}>
                    ✏️ Manual
                  </button>
                  {category !== 'custom' && (
                    <button className={`btn-secondary text-xs flex-1 py-2.5 ${ideaMode === 'trending' ? '!border-[var(--primary)]' : ''}`}
                      disabled={hasResult}
                      onClick={onTrendingClick}>
                      📈 Trending
                    </button>
                  )}
                </div>

                {/* Mode Manual: input teks langsung */}
                {ideaMode === 'manual' && (
                  <input
                    className="input-field"
                    disabled={hasResult}
                    placeholder="Ketik ide topik kamu..."
                    value={topic}
                    onChange={(e) => onTopicChange(e.target.value)}
                  />
                )}

                {/* Mode Trending / AI Suggest: chips dulu, input setelah pilih */}
                {ideaMode !== 'manual' && (
                  <>
                    {/* Loading */}
                    {isLoadingIdeas && (
                      <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                        <div className="w-3 h-3 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
                        Mencari ide...
                      </div>
                    )}

                    {/* Chips */}
                    {!isLoadingIdeas && ideasList.length > 0 && (
                      <div>
                        <p className="text-xs text-[var(--muted-foreground)] mb-2">
                          Pilih salah satu ide di bawah untuk digunakan:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {ideasList.map((idea, idx) => (
                            <button key={idx}
                              disabled={hasResult}
                              className={`text-xs px-3 py-2.5 rounded-full transition-colors ${
                                selectedIdea === idea
                                  ? 'bg-[var(--primary)] text-white'
                                  : 'bg-[var(--border)] hover:bg-[var(--primary)] hover:text-white'
                              }`}
                              onClick={() => onSelectIdea(idea)}>
                              {idea}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Error */}
                    {!isLoadingIdeas && trendingFailed && (
                      <StatusMessage variant="warning">
                        Belum ada data trending untuk kategori ini, coba lagi nanti.
                      </StatusMessage>
                    )}
                  </>
                )}
              </>
            )}
          </div>

          {/* DESKTOP: always full — toggle + chips always visible */}
          <div className="hidden md:block">
            {/* Toggle sumber ide — disabled jika sudah ada hasil */}
            <div className="flex gap-2 mb-2">
              <button className={`btn-secondary text-xs flex-1 py-2.5 ${ideaMode === 'manual' ? '!border-[var(--primary)]' : ''}`}
                disabled={hasResult}
                onClick={onManualClick}>
                ✏️ Manual
              </button>
              {category !== 'custom' && (
                <button className={`btn-secondary text-xs flex-1 py-2.5 ${ideaMode === 'trending' ? '!border-[var(--primary)]' : ''}`}
                  disabled={hasResult}
                  onClick={onTrendingClick}>
                  📈 Trending
                </button>
              )}
            </div>

            {/* Mode Manual: input teks langsung */}
            {ideaMode === 'manual' && (
              <input
                className="input-field"
                disabled={hasResult}
                placeholder="Ketik ide topik kamu..."
                value={topic}
                onChange={(e) => onTopicChange(e.target.value)}
              />
            )}

            {/* Mode Trending / AI Suggest: chips dulu, input setelah pilih */}
            {ideaMode !== 'manual' && (
              <>
                {/* Loading */}
                {isLoadingIdeas && (
                  <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                    <div className="w-3 h-3 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
                    Mencari ide...
                  </div>
                )}

                {/* Chips */}
                {!isLoadingIdeas && ideasList.length > 0 && (
                  <div>
                    <p className="text-xs text-[var(--muted-foreground)] mb-2">
                      Pilih salah satu ide di bawah untuk digunakan:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {ideasList.map((idea, idx) => (
                        <button key={idx}
                          disabled={hasResult}
                          className={`text-xs px-3 py-2.5 rounded-full transition-colors ${
                            selectedIdea === idea
                              ? 'bg-[var(--primary)] text-white'
                              : 'bg-[var(--border)] hover:bg-[var(--primary)] hover:text-white'
                          }`}
                          onClick={() => onSelectIdea(idea)}>
                          {idea}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Error */}
                {!isLoadingIdeas && trendingFailed && (
                  <StatusMessage variant="warning">
                    Belum ada data trending untuk kategori ini, coba lagi nanti.
                  </StatusMessage>
                )}
              </>
            )}
          </div>

          {/* Input teks muncul setelah chip dipilih — muncul di kedua versi (mobile collapsed & desktop) */}
          {selectedIdea && (
            <div className="mt-3">
              <label className="text-xs text-[var(--muted-foreground)] mb-1 block">
                Atau edit ide yang dipilih:
              </label>
              <input
                className="input-field"
                disabled={hasResult}
                placeholder="Edit ide..."
                value={topic}
                onChange={(e) => onTopicChange(e.target.value)}
              />
            </div>
          )}
        </div>
      )}

      {/* Custom kategori — input nama niche */}
      {category === 'custom' && (
        <div>
          <label className="label">Nama Niche / Topik Kamu</label>
          <input
            className="input-field"
            disabled={hasResult}
            placeholder="Contoh: Kuliner Nusantara, Parenting, Teknologi..."
            value={nicheName}
            onChange={(e) => onNicheNameChange(e.target.value)}
          />
          <p className="text-xs text-[var(--muted-foreground)] mt-1">
            Tentukan niche spesifik untuk konten kamu. Misalnya: "Kuliner Nusantara", "Parenting", "Review Film", dll.
          </p>
        </div>
      )}
    </>
  );
}