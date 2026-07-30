'use client';

import { useState, useEffect } from 'react';
import { CategoryId } from '@/lib/types';

interface CategoryCard {
  id: CategoryId;
  emoji: string;
  name: string;
  desc: string;
}

interface CategoryGridProps {
  selectedCategory: CategoryId | '';
  hasResult: boolean;
  onSelectCategory: (id: CategoryId) => void;
}

const presetCategoryCards: CategoryCard[] = [
  { id: 'horror', emoji: '👻', name: 'Horror', desc: 'Urban legend Indonesia' },
  { id: 'psikologi', emoji: '🧠', name: 'Psikologi', desc: 'Fakta pikiran manusia' },
  { id: 'romance', emoji: '💕', name: 'Romance', desc: 'Cerita cinta sehari-hari' },
  { id: 'motivasi', emoji: '🔥', name: 'Motivasi', desc: 'Inspirasi personal' },
  { id: 'edukasi', emoji: '📚', name: 'Edukasi', desc: 'Fakta seru & unik' },
  { id: 'affiliate', emoji: '🛒', name: 'Affiliate', desc: 'Review produk otomatis' },
  { id: 'misteri', emoji: '🔍', name: 'Misteri', desc: 'Konspirasi & fenomena aneh' },
  { id: 'sejarah', emoji: '🏛️', name: 'Sejarah', desc: 'Fakta sejarah tersembunyi' },
  { id: 'keuangan', emoji: '💰', name: 'Keuangan', desc: 'Tips finansial pribadi' },
];

const customCategoryCard: CategoryCard = { id: 'custom', emoji: '✏️', name: 'Custom', desc: 'Niche/topik bebas' };

const allCards: CategoryCard[] = [...presetCategoryCards, customCategoryCard];

export default function CategoryGrid({ selectedCategory, hasResult, onSelectCategory }: CategoryGridProps) {
  const [mobileExpanded, setMobileExpanded] = useState(true);

  // Mobile: collapse grid setelah kategori dipilih
  useEffect(() => {
    if (selectedCategory) {
      setMobileExpanded(false);
    } else {
      setMobileExpanded(true);
    }
  }, [selectedCategory]);

  const selectedCard = selectedCategory
    ? allCards.find(c => c.id === selectedCategory)
    : null;

  return (
    <div>
      <label className="label">Kategori Konten</label>

      {/* ===== MOBILE VERSION (md:hidden) ===== */}
      <div className="md:hidden">
        {mobileExpanded ? (
          /* Grid 10 item (9 preset + custom) — genap 5 baris */
          <div className="grid grid-cols-2 gap-2">
            {allCards.map((card) => {
              const isSelected = selectedCategory === card.id;
              return (
                <button
                  key={card.id}
                  disabled={hasResult}
                  onClick={() => { onSelectCategory(card.id); }}
                  className={`relative flex flex-col items-center gap-1 p-4 rounded-xl border-2 transition-all text-center
                    ${isSelected
                      ? 'border-[var(--primary)] bg-[var(--primary)]/10'
                      : 'border-[var(--border)] hover:border-[var(--primary)]/50 bg-[var(--card-bg)]'
                    }
                    ${hasResult ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                  `}
                >
                  {isSelected && (
                    <span className="absolute top-1 right-1 text-xs text-[var(--primary)]">✓</span>
                  )}
                  <span className="text-2xl">{card.emoji}</span>
                  <span className="text-xs font-semibold">{card.name}</span>
                  <span className="text-xs text-[var(--muted-foreground)] leading-tight">{card.desc}</span>
                </button>
              );
            })}
          </div>
        ) : selectedCard ? (
          /* Collapsed bar — emoji + nama + tombol ganti */
          <div className="flex items-center gap-3 p-3 rounded-xl border-2 border-[var(--primary)] bg-[var(--primary)]/10">
            <span className="text-2xl">{selectedCard.emoji}</span>
            <div className="flex-1">
              <span className="text-sm font-semibold">{selectedCard.name}</span>
              <span className="text-xs text-[var(--muted-foreground)] ml-2">{selectedCard.desc}</span>
            </div>
            <button
              className="btn-secondary text-xs py-2 px-3"
              onClick={() => setMobileExpanded(true)}
            >
              Ganti Kategori
            </button>
          </div>
        ) : null}
      </div>

      {/* ===== DESKTOP VERSION (hidden md:block) ===== */}
      <div className="hidden md:block">
        <div className="grid grid-cols-3 gap-2">
          {presetCategoryCards.map((card) => {
            const isSelected = selectedCategory === card.id;
            return (
              <button
                key={card.id}
                disabled={hasResult}
                onClick={() => { onSelectCategory(card.id); }}
                className={`relative flex flex-col items-center gap-1 p-4 rounded-xl border-2 transition-all text-center
                  ${isSelected
                    ? 'border-[var(--primary)] bg-[var(--primary)]/10'
                    : 'border-[var(--border)] hover:border-[var(--primary)]/50 bg-[var(--card-bg)]'
                  }
                  ${hasResult ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                {isSelected && (
                  <span className="absolute top-1 right-1 text-xs text-[var(--primary)]">✓</span>
                )}
                <span className="text-2xl">{card.emoji}</span>
                <span className="text-xs font-semibold">{card.name}</span>
                <span className="text-xs text-[var(--muted-foreground)] leading-tight">{card.desc}</span>
              </button>
            );
          })}
        </div>

        {/* Separator + Custom card — terpisah dari grid 3x3 biar center */}
        <div className="relative flex items-center gap-3 my-3">
          <div className="flex-1 border-t border-[var(--border)]" />
          <span className="text-xs text-[var(--muted-foreground)]">atau</span>
          <div className="flex-1 border-t border-[var(--border)]" />
        </div>

        <button
          disabled={hasResult}
          onClick={() => { onSelectCategory(customCategoryCard.id); }}
          className={`w-full flex items-center justify-center gap-2 p-2.5 rounded-xl border-2 border-dashed transition-all text-center
            ${selectedCategory === customCategoryCard.id
              ? 'border-[var(--primary)] bg-[var(--primary)]/10'
              : 'border-[var(--border)] hover:border-[var(--primary)]/50 bg-[var(--card-bg)]'
            }
            ${hasResult ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          <span className="text-lg">{customCategoryCard.emoji}</span>
          <span className="text-sm font-semibold">{customCategoryCard.name}</span>
          <span className="text-xs text-[var(--muted-foreground)]">{customCategoryCard.desc}</span>
        </button>
      </div>
    </div>
  );
}