'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { allCategories } from '@/lib/categories';
import { durationOptions } from '@/lib/duration';
import { CategoryId, DurationTier, Scene, AffiliateInput, TTSProviderId, CartesiaSettings, ElevenLabsSettings, GTTSSettings } from '@/lib/types';
import { getCategoryEmoji } from '@/lib/utils/category';

export default function Home() {
  // Input state
  const [category, setCategory] = useState<CategoryId | ''>('');
  const [topic, setTopic] = useState('');
  const [duration, setDuration] = useState<DurationTier | ''>('');
  const [ideaMode, setIdeaMode] = useState<'manual' | 'trending'>('manual');
  const [ideasList, setIdeasList] = useState<string[]>([]);
  const [isLoadingIdeas, setIsLoadingIdeas] = useState(false);
  const [selectedIdea, setSelectedIdea] = useState<string | null>(null);
  const [trendingFailed, setTrendingFailed] = useState(false);
  const [affiliateInput, setAffiliateInput] = useState<AffiliateInput>({
    productUrl: '', productDescription: '', productPrice: '', reviews: [''],
  });

  // Result state
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [failedSegment, setFailedSegment] = useState<number | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [progressSeg, setProgressSeg] = useState<{ current: number; total: number } | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  // Scraping state
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeError, setScrapeError] = useState('');
  const [showManualFallback, setShowManualFallback] = useState(false);
  const [expandedScene, setExpandedScene] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);
  const [showNewContentDialog, setShowNewContentDialog] = useState(false);

  // TTS state
  const [ttsProvider, setTtsProvider] = useState<TTSProviderId>('google');
  const [cartesiaSettings, setCartesiaSettings] = useState<CartesiaSettings>({
    voice_id: '', speed: 1.0, emotion: undefined,
  });
  const [elevenSettings, setElevenSettings] = useState<ElevenLabsSettings>({
    voice_id: '', stability: 0.5, similarity_boost: 0.75, style: 0, use_speaker_boost: true, speed: 1.0,
  });
  const [googleSettings, setGoogleSettings] = useState<GTTSSettings>({
    lang: 'id', tld: 'co.id', slow: false,
  });
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioError, setAudioError] = useState('');
  const [audioProgress, setAudioProgress] = useState('');
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string | null>(null);
  const [previewAudioError, setPreviewAudioError] = useState('');
  const [isInstantPreviewing, setIsInstantPreviewing] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup ObjectURL saat komponen unmount
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (previewAudioUrl) URL.revokeObjectURL(previewAudioUrl);
    };
  }, [audioUrl, previewAudioUrl]);

  const selectedCategory = allCategories.find(c => c.id === category);
  const isAffiliate = category === 'affiliate';
  const hasResult = scenes.length > 0;

  const fullNarration = scenes.map(s => s.narration).join('\n\n');

  const handleCancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const handleGenerate = async () => {
    if (!category || !topic || !duration) return;

    // Cancel previous jika masih berjalan
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsGenerating(true);
    setIsCancelled(false);
    setProgressMsg('Membuat outline cerita...');
    setScenes([]);
    setAudioUrl(null);
    setErrorMessage('');

    try {
      const affInput: AffiliateInput | undefined = isAffiliate ? {
        productUrl: affiliateInput.productUrl || undefined,
        productDescription: affiliateInput.productDescription,
        productPrice: affiliateInput.productPrice,
        productRating: affiliateInput.productRating,
        reviews: (affiliateInput.reviews || []).filter(r => r.trim().length > 0),
      } : undefined;

      const response = await fetch('/api/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, topic, duration, affiliateInput: affInput }),
        signal: controller.signal,
      });

      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Gagal generate script');

      setScenes(data.data.scenes);
      setFailedSegment(data.data.failedSegment);
      setProgressMsg('Script selesai!');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setIsCancelled(true);
        setProgressMsg('');
      } else {
        setErrorMessage(error instanceof Error ? error.message : 'Terjadi kesalahan');
      }
    } finally {
      setIsGenerating(false);
      setProgressSeg(null);
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  };

  const handleCopyText = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(fullNarration);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select text in textarea
      if (textAreaRef.current) {
        textAreaRef.current.select();
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  }, [fullNarration]);

  const handleInstantPreview = useCallback(() => {
    if (scenes.length === 0) return;
    // Cancel previous speech
    window.speechSynthesis.cancel();

    const text = scenes[0].narration.split(' ').slice(0, 7).join(' ');
    if (!text) return;

    setIsInstantPreviewing(true);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'id-ID';
    utterance.rate = 1.0;
    utterance.onend = () => setIsInstantPreviewing(false);
    utterance.onerror = () => setIsInstantPreviewing(false);
    window.speechSynthesis.speak(utterance);
  }, [scenes]);

  const handlePreviewAudio = async () => {
    if (scenes.length === 0) return;
    setIsPreviewing(true);
    setPreviewAudioError('');
    setPreviewAudioUrl(null);

    try {
      let settings: unknown;
      switch (ttsProvider) {
        case 'cartesia': settings = cartesiaSettings; break;
        case 'elevenlabs': settings = elevenSettings; break;
        case 'google': settings = googleSettings; break;
      }

      const response = await fetch('/api/generate-tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenes, provider: ttsProvider, settings, preview: true }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Gagal preview audio (${response.status})`);
      }

      const blob = await response.blob();
      if (previewAudioUrl) URL.revokeObjectURL(previewAudioUrl);
      const url = URL.createObjectURL(blob);
      setPreviewAudioUrl(url);
    } catch (error) {
      setPreviewAudioError(error instanceof Error ? error.message : 'Gagal preview audio');
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleGenerateAudio = async () => {
    if (scenes.length === 0) return;
    setIsGeneratingAudio(true);
    setAudioError('');
    setAudioUrl(null);

    try {
      let settings: unknown;
      switch (ttsProvider) {
        case 'cartesia': settings = cartesiaSettings; break;
        case 'elevenlabs': settings = elevenSettings; break;
        case 'google': settings = googleSettings; break;
      }

      setAudioProgress(`Memproses ${scenes.length} scene melalui ${ttsProvider.toUpperCase()}...`);

      const response = await fetch('/api/generate-tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenes, provider: ttsProvider, settings }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Gagal generate audio (${response.status})`);
      }

      setAudioProgress('Mendownload audio...');
      const blob = await response.blob();
      // Revoke URL lama untuk mencegah memory leak
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      setAudioProgress('');
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Gagal generate audio';
      // Tambah info fallback
      const otherProviders = ['elevenlabs', 'cartesia', 'google'].filter((p): p is TTSProviderId => p !== ttsProvider);
      setAudioError(`${errMsg}\n\n💡 Coba pilih provider lain: ${otherProviders.join(', ')}`);
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  useEffect(() => {
    if (!category || isAffiliate) {
      setIdeasList([]);
      return;
    }
    if (ideaMode === 'manual' || ideaMode === 'trending') {
      setIdeasList([]);
      return;
    }

    let cancelled = false;
    setIsLoadingIdeas(true);
    setIdeasList([]);

    const timer = setTimeout(() => {
      const fetchIdeas = async () => {
        try {
          // Jika mode trending, coba trending dulu
          if (ideaMode === 'trending') {
            const res1 = await fetch(`/api/trending-ideas?category=${encodeURIComponent(category)}`);
            const d1 = await res1.json();
            console.log('[Ideas] Trending response:', d1);
            if (!cancelled && d1.success && Array.isArray(d1.ideas) && d1.ideas.length > 0) {
              console.log('[Ideas] Setting ideasList from trending:', d1.ideas);
              setIdeasList(d1.ideas);
              setIsLoadingIdeas(false);
              return;
            }
            console.log('[Ideas] Trending gagal');
          }
          if (!cancelled) {
            setTrendingFailed(true);
            setIdeasList([]);
          }
        } catch (e) {
          console.error('Gagal fetch ideas:', e);
          if (!cancelled) setIdeasList([]);
        } finally {
          if (!cancelled) setIsLoadingIdeas(false);
        }
      };

      fetchIdeas();
    }, 800);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [category, ideaMode, isAffiliate]);

  const handleNewContent = () => {
    setShowNewContentDialog(false);
    setCategory('');
    setTopic('');
    setDuration('');
    setScenes([]);
    setFailedSegment(null);
    setIsGenerating(false);
    setProgressMsg('');
    setProgressSeg(null);
    setErrorMessage('');
    setAudioUrl(null);
    setAudioError('');
    setAudioProgress('');
    setPreviewAudioUrl(null);
    setPreviewAudioError('');
    setIsCancelled(false);
    setAffiliateInput({ productUrl: '', productDescription: '', productPrice: '', reviews: [''] });
    setIdeaMode('manual');
    setIdeasList([]);
    setSelectedIdea(null);
  };

  const handleIdeaClick = (idea: string) => {
    setSelectedIdea(idea);
    setTopic(idea);
  };

  const getMoodBadgeColor = (mood: string) => {
    const colors: Record<string, string> = {
      mencekam: '#ef4444', gelap: '#1e293b', misterius: '#8b5cf6',
      intens: '#f97316', shock: '#dc2626', sunyi: '#64748b',
      lega: '#22c55e', fakta: '#3b82f6', terang: '#eab308',
      hangat: '#f59e0b', sedih: '#6366f1', rindu: '#ec4899',
      netral: '#888', semangat: '#f97316', reflektif: '#a855f7',
    };
    return colors[mood] || '#888';
  };

  // Data kategori untuk card grid
  const categoryCards = [
    { id: 'horror' as CategoryId, emoji: '👻', name: 'Horror', desc: 'Urban legend Indonesia' },
    { id: 'psychology' as CategoryId, emoji: '🧠', name: 'Psikologi', desc: 'Fakta pikiran manusia' },
    { id: 'romance' as CategoryId, emoji: '💕', name: 'Romance', desc: 'Cerita cinta sehari-hari' },
    { id: 'motivation' as CategoryId, emoji: '🔥', name: 'Motivasi', desc: 'Inspirasi personal' },
    { id: 'education' as CategoryId, emoji: '📚', name: 'Edukasi', desc: 'Fakta seru & unik' },
    { id: 'affiliate' as CategoryId, emoji: '🛒', name: 'Affiliate', desc: 'Review produk otomatis' },
  ];

  return (
    <div className="space-y-6">
      {/* ===== BAGIAN ATAS: INPUT ===== */}
      <div className="card space-y-4">
        {/* Headline */}
        <div className="text-center space-y-1">
          <h1 className="text-xl font-bold">Buat Skrip Video Viral + Suara AI dalam 30 Detik 🚀</h1>
          <p className="text-sm text-[var(--muted-foreground)]">Pilih kategori, masukkan ide, langsung generate.</p>
        </div>

        {/* Kategori — grid card 2x3, disabled jika sudah ada hasil */}
        <div>
          <label className="label">Kategori Konten</label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {categoryCards.map((card) => {
              const isSelected = category === card.id;
              return (
                <button
                  key={card.id}
                  disabled={hasResult}
                  onClick={() => { setCategory(card.id as CategoryId); setScenes([]); setAudioUrl(null); }}
                  className={`relative flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all text-center
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
                  <span className="text-[10px] text-[var(--muted-foreground)] leading-tight">{card.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Form yang muncul setelah kategori dipilih — smooth appear */}
        {category && (
        <div className="transition-all duration-300 ease-in-out animate-[fadeSlideUp_0.3s_ease-out] space-y-4">
          {/* Topik / Ide — dengan toggle sumber ide untuk non-affiliate */}
          {!isAffiliate && (
            <div>
              <label className="label">Judul / Ide Topik</label>

              {/* Toggle sumber ide — disabled jika sudah ada hasil */}
              <div className="flex gap-2 mb-2">
                <button className={`btn-secondary text-xs flex-1 ${ideaMode === 'manual' ? '!border-[var(--primary)]' : ''}`}
                  disabled={hasResult}
                  onClick={() => { setIdeaMode('manual'); setSelectedIdea(null); }}>
                  ✏️ Manual
                </button>
                {/* Trending dinonaktifkan sementara */}
                <button className={`btn-secondary text-xs flex-1 ${ideaMode === 'trending' ? '!border-[var(--primary)]' : ''}`}
                  disabled={true}
                  onClick={() => { setIdeaMode('trending'); setSelectedIdea(null); setTopic(''); setTrendingFailed(false); }}>
                  📈 Trending (Segera)
                </button>
              </div>

              {/* Mode Manual: input teks langsung */}
              {ideaMode === 'manual' && (
                <input
                  className="input-field"
                  disabled={hasResult}
                  placeholder="Ketik ide topik kamu..."
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
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
                            className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                              selectedIdea === idea
                                ? 'bg-[var(--primary)] text-white'
                                : 'bg-[var(--border)] hover:bg-[var(--primary)] hover:text-white'
                            }`}
                            onClick={() => handleIdeaClick(idea)}>
                            {idea}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Error */}
                  {!isLoadingIdeas && trendingFailed && (
                    <p className="text-xs text-red-400">
                      Trending tidak tersedia, gunakan Manual.
                    </p>
                  )}

                  {/* Input teks muncul setelah chip dipilih */}
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
                        onChange={(e) => setTopic(e.target.value)}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          )}


          {/* Affiliate form — cukup paste URL, sisanya otomatis */}
          {isAffiliate && (
            <div className="space-y-3">
              <div>
                <label className="label">URL Produk</label>
                <div className="flex gap-2">
                  <input className="input-field flex-1" placeholder="https://tokopedia.com/... atau https://shopee.co.id/..." value={affiliateInput.productUrl}
                    onChange={(e) => setAffiliateInput({ ...affiliateInput, productUrl: e.target.value })}
                    onBlur={async (e) => {
                      const url = e.target.value.trim();
                      if (!url) return;
                      try {
                        const parsed = new URL(url);
                        const allowed = ['tokopedia.com', 'shopee.co.id', 'tiktok.com'];
                        if (!allowed.some(d => parsed.hostname.includes(d))) return;
                      } catch { return; }
                      setIsScraping(true);
                      setScrapeError('');
                      try {
                        const res = await fetch('/api/scrape-product', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ url }),
                        });
                        const data = await res.json();
                        if (data.success && data.data) {
                          const d = data.data;
                          const desc = d.description || d.title || '';
                          const scrapedPrice = d.price || d.currency ? (d.price || '') : '';
                          setAffiliateInput({
                            productUrl: url,
                            productDescription: desc,
                            productPrice: scrapedPrice,
                            productRating: d.rating || undefined,
                            reviews: d.reviewSnippets && d.reviewSnippets.length > 0
                              ? d.reviewSnippets
                              : [],
                          });
                          if (desc && !topic) {
                            setTopic(desc);
                          }
                        } else {
                          setScrapeError(data.error || 'Tidak bisa mengambil data');
                        }
                      } catch {
                        setScrapeError('Gagal mengambil data produk');
                      } finally {
                        setIsScraping(false);
                      }
                    }} />
                  {isScraping && (
                    <div className="flex items-center">
                      <div className="w-4 h-4 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>
                {scrapeError && (
                  <p className="text-xs text-yellow-400 mt-1">{scrapeError}</p>
                )}
                {affiliateInput.productDescription && (
                  <p className="text-xs text-green-400 mt-1">
                    ✅ Data produk berhasil diambil! {affiliateInput.productPrice ? `Harga: Rp ${affiliateInput.productPrice}` : ''}
                  </p>
                )}

                {/* Manual fallback form when scraping fails */}
                {scrapeError && (
                  <div className="mt-3 p-3 rounded-lg border border-yellow-800 bg-yellow-900/20 space-y-2">
                    <p className="text-xs text-yellow-300">
                      ⚠️ Beberapa produk (terutama dari Shopee) sulit diambil datanya otomatis. Silakan isi manual di bawah ini.
                    </p>
                    <div className="space-y-2">
                      <input
                        className="input-field text-sm"
                        placeholder="Nama produk"
                        value={affiliateInput.productDescription}
                        onChange={(e) => setAffiliateInput({ ...affiliateInput, productDescription: e.target.value })}
                      />
                      <input
                        className="input-field text-sm"
                        placeholder="Harga (contoh: Rp 150.000)"
                        value={affiliateInput.productPrice}
                        onChange={(e) => setAffiliateInput({ ...affiliateInput, productPrice: e.target.value })}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Durasi — disabled jika sudah ada hasil */}
          <div>
            <label className="label">Durasi Konten</label>
            <select className="select-field" value={duration}
              disabled={hasResult}
              onChange={(e) => setDuration(e.target.value as DurationTier)}>
              <option value="">— Pilih Durasi —</option>
              {durationOptions.map((d) => (
                <option key={d.id} value={d.id}>{d.label} — {d.description}</option>
              ))}
            </select>
          </div>

          {/* Tombol Generate / Cancel / Buat Baru */}
          <div className="flex gap-2">
            {!hasResult && (
              <button className="btn-primary w-full text-base py-3"
                disabled={!category || !topic || !duration || isGenerating}
                onClick={handleGenerate}
                style={{ display: isGenerating ? 'none' : undefined }}>
                🚀 Generate Script
              </button>
            )}
            {isGenerating && (
              <button className="btn-secondary w-full text-base py-3"
                onClick={handleCancel}>
                ⏹️ Batalkan
              </button>
            )}
            {hasResult && (
              <button className="btn-primary w-full text-base py-3"
                onClick={() => setShowNewContentDialog(true)}>
                🆕 Buat Konten Baru
              </button>
            )}
          </div>

          {/* Progress */}
          {isGenerating && (
            <div className="text-sm text-[var(--muted-foreground)] flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
              {progressMsg}
            </div>
          )}

          {/* Cancel message */}
          {isCancelled && (
            <div className="text-sm text-yellow-400 bg-yellow-900/20 p-3 rounded-lg border border-yellow-800">
              ⏹️ Proses dibatalkan
            </div>
          )}

          {/* Error */}
          {errorMessage && (
            <div className="text-sm text-red-400 bg-red-900/20 p-3 rounded-lg border border-red-800">
              ❌ {errorMessage}
            </div>
          )}

          {/* Dialog konfirmasi Buat Konten Baru */}
          {showNewContentDialog && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
              <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-6 max-w-sm w-full mx-4 space-y-4">
                <h3 className="font-semibold text-lg">🆕 Buat Konten Baru</h3>
                <p className="text-sm text-[var(--muted-foreground)]">
                  Script dan audio akan dihapus. Lanjut?
                </p>
                <div className="flex gap-2">
                  <button className="btn-secondary flex-1" onClick={() => setShowNewContentDialog(false)}>
                    Batal
                  </button>
                  <button className="btn-primary flex-1" onClick={handleNewContent}>
                    Ya, Buat Baru
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        )}
      </div>

      {/* ===== BAGIAN BAWAH: HASIL ===== */}
      {hasResult && (
        <div className="space-y-4">
          {/* Header hasil */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {failedSegment ? '⚠️ Script Tidak Lengkap' : '✅ Script Selesai!'}
            </h2>
            <span className="text-sm text-[var(--muted-foreground)]">
              {scenes.length} scene · ~{scenes.reduce((sum, s) => sum + s.narration.split(/\s+/).length, 0)} kata
            </span>
          </div>

          {failedSegment && (
            <div className="card border-yellow-600 bg-yellow-900/20">
              <p className="text-sm text-yellow-400">
                Script berhenti di bagian {failedSegment}. Klik Generate lagi untuk mencoba ulang.
              </p>
            </div>
          )}

          {/* === BLOK TEKS COPYABLE === */}
          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Full Narasi (copyable)</label>
              <button onClick={handleCopyText} className="text-sm text-[var(--primary)] hover:underline">
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

          {/* === OPSI KONVERSI KE AUDIO === */}
          <div className="card space-y-4">
            <h3 className="font-semibold">🔊 Konversi ke Audio</h3>

            {/* Pilih Provider */}
            <div>
              <label className="label">Provider Suara</label>
              <select className="select-field" value={ttsProvider}
                onChange={(e) => { setTtsProvider(e.target.value as TTSProviderId); setAudioUrl(null); setAudioError(''); }}>
                <option value="google">Google TTS (Gratis, suara robotik)</option>
                <option value="cartesia">Cartesia Sonic (Kualitas tinggi, perlu API key)</option>
                <option value="elevenlabs">ElevenLabs (Kualitas tinggi, perlu API key)</option>
              </select>
            </div>

            {/* Cartesia Settings */}
            {ttsProvider === 'cartesia' && (
              <div className="space-y-3">
                <div>
                  <label className="label">Pilih Suara</label>
                  <select className="select-field" value={cartesiaSettings.voice_id}
                    onChange={(e) => setCartesiaSettings({ ...cartesiaSettings, voice_id: e.target.value })}>
                    <option value="">Default (dari API key)</option>
                    <option value="andi">Andi</option>
                    <option value="siti">Siti</option>
                  </select>
                </div>
                <div>
                  <label className="label">Speed: {cartesiaSettings.speed.toFixed(1)}x</label>
                  <input type="range" min="0.6" max="1.5" step="0.1" className="slider-field"
                    value={cartesiaSettings.speed}
                    onChange={(e) => setCartesiaSettings({ ...cartesiaSettings, speed: parseFloat(e.target.value) })} />
                  <div className="flex justify-between text-xs text-[var(--muted-foreground)]">
                    <span>0.6x (lambat)</span><span>1.5x (cepat)</span>
                  </div>
                </div>
                <div>
                  <label className="label">Emotion (opsional)</label>
                  <select className="select-field" value={cartesiaSettings.emotion || ''}
                    onChange={(e) => setCartesiaSettings({ ...cartesiaSettings, emotion: e.target.value || undefined })}>
                    <option value="">— Tanpa emotion —</option>
                    <option value="neutral">Neutral</option>
                    <option value="calm">Calm</option>
                    <option value="angry">Angry</option>
                    <option value="sad">Sad</option>
                    <option value="scared">Scared</option>
                    <option value="curious">Curious</option>
                    <option value="mysterious">Mysterious</option>
                  </select>
                </div>
              </div>
            )}

            {/* ElevenLabs Settings */}
            {ttsProvider === 'elevenlabs' && (
              <div className="space-y-3">
                <div>
                  <label className="label">Stability: {elevenSettings.stability.toFixed(2)}</label>
                  <input type="range" min="0" max="1" step="0.05" className="slider-field"
                    value={elevenSettings.stability}
                    onChange={(e) => setElevenSettings({ ...elevenSettings, stability: parseFloat(e.target.value) })} />
                </div>
                <div>
                  <label className="label">Similarity Boost: {elevenSettings.similarity_boost.toFixed(2)}</label>
                  <input type="range" min="0" max="1" step="0.05" className="slider-field"
                    value={elevenSettings.similarity_boost}
                    onChange={(e) => setElevenSettings({ ...elevenSettings, similarity_boost: parseFloat(e.target.value) })} />
                </div>
                <div>
                  <label className="label">Style: {elevenSettings.style.toFixed(2)}</label>
                  <input type="range" min="0" max="1" step="0.05" className="slider-field"
                    value={elevenSettings.style}
                    onChange={(e) => setElevenSettings({ ...elevenSettings, style: parseFloat(e.target.value) })} />
                </div>
                <div>
                  <label className="label">Speed: {elevenSettings.speed.toFixed(1)}x</label>
                  <input type="range" min="0.5" max="2" step="0.1" className="slider-field"
                    value={elevenSettings.speed}
                    onChange={(e) => setElevenSettings({ ...elevenSettings, speed: parseFloat(e.target.value) })} />
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="speakerBoost" checked={elevenSettings.use_speaker_boost}
                    onChange={(e) => setElevenSettings({ ...elevenSettings, use_speaker_boost: e.target.checked })} />
                  <label htmlFor="speakerBoost" className="text-sm">Speaker Boost</label>
                </div>
              </div>
            )}

            {/* Google TTS Settings */}
            {ttsProvider === 'google' && (
              <div className="space-y-3">
                <div>
                  <label className="label">Bahasa</label>
                  <select className="select-field" value={googleSettings.lang}
                    onChange={(e) => setGoogleSettings({ ...googleSettings, lang: e.target.value })}>
                    <option value="id">Bahasa Indonesia</option>
                    <option value="en">English</option>
                    <option value="ja">Japanese</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="slowMode" checked={googleSettings.slow}
                    onChange={(e) => setGoogleSettings({ ...googleSettings, slow: e.target.checked })} />
                  <label htmlFor="slowMode" className="text-sm">Mode Lambat (slow)</label>
                </div>
                <p className="text-xs text-[var(--muted-foreground)]">
                  ⚠️ Google TTS memiliki kontrol kecepatan terbatas (hanya slow/normal). 
                  Kualitas suara lebih robotik dibanding Cartesia/ElevenLabs.
                </p>
              </div>
            )}

            {/* Loading progress audio */}
            {isGeneratingAudio && (
              <div className="space-y-2">
                <button className="btn-primary w-full" disabled={true}>
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ⏳ Generating Audio...
                  </div>
                </button>
                <div className="text-xs text-[var(--muted-foreground)] text-center animate-pulse">
                  {audioProgress}
                </div>
                {/* Progress bar per-scene */}
                <div className="w-full bg-[var(--border)] rounded-full h-2 overflow-hidden">
                  <div className="bg-[var(--primary)] h-2 rounded-full animate-pulse"
                    style={{ width: '100%', transition: 'width 0.5s ease' }} />
                </div>
              </div>
            )}

            {/* Tombol Instant Preview + Preview + Generate Audio (idle) */}
            {!isGeneratingAudio && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <button className="btn-secondary text-sm flex-[0.3]"
                    disabled={scenes.length === 0 || isInstantPreviewing}
                    onClick={handleInstantPreview}>
                    {isInstantPreviewing ? '🔊 ...' : '⚡ Instant'}
                  </button>
                  <button className="btn-secondary flex-[0.3]"
                    disabled={scenes.length === 0 || isPreviewing}
                    onClick={handlePreviewAudio}>
                    {isPreviewing ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="w-3 h-3 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
                        Preview...
                      </span>
                    ) : '🔊 Preview'}
                  </button>
                  <button className="btn-primary flex-[0.4]"
                    disabled={scenes.length === 0}
                    onClick={handleGenerateAudio}>
                    🎵 Generate Audio
                  </button>
                </div>
                <p className="text-[10px] text-[var(--muted-foreground)] text-center">
                  ⚡ = suara browser, bukan suara provider asli
                </p>
              </div>
            )}

            {/* Mini preview player */}
            {previewAudioUrl && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                  <span>🔊 Preview (7 kata pertama)</span>
                </div>
                <audio controls className="w-full h-8" src={previewAudioUrl} autoPlay>
                  Browser tidak mendukung audio player.
                </audio>
              </div>
            )}

            {previewAudioError && (
              <div className="text-sm text-red-400 bg-red-900/20 p-3 rounded-lg border border-red-800">
                ❌ {previewAudioError}
              </div>
            )}

            {audioError && (
              <div className="text-sm text-red-400 bg-red-900/20 p-3 rounded-lg border border-red-800 whitespace-pre-line">
                ❌ {audioError}
              </div>
            )}

            {/* Audio Player + Download */}
            {audioUrl && (
              <div className="space-y-3">
                <audio ref={audioRef} controls className="w-full" src={audioUrl}>
                  Browser tidak mendukung audio player.
                </audio>
                <div className="flex gap-2">
                  <a href={audioUrl} download="viraloop-audio.mp3"
                    className="btn-secondary text-sm flex-1 text-center">
                    ⬇️ Download MP3
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* === DAFTAR SCENE === */}
          <div className="space-y-2">
            <h3 className="font-semibold">📜 Daftar Scene</h3>
            {scenes.map((scene, i) => (
              <div key={i} className="card">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-[var(--muted-foreground)]">Scene {i + 1}</span>
                  {scene.is_hook && (
                    <span className="text-xs bg-yellow-600/20 text-yellow-400 px-2 py-0.5 rounded">HOOK</span>
                  )}
                  <span className="text-xs px-2 py-0.5 rounded"
                    style={{ backgroundColor: getMoodBadgeColor(scene.scene_mood) + '33', color: getMoodBadgeColor(scene.scene_mood) }}>
                    {scene.scene_mood}
                  </span>
                  <button onClick={() => setExpandedScene(expandedScene === i ? null : i)}
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
        </div>
      )}
    </div>
  );
}