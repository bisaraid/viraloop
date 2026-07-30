'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { allCategories } from '@/lib/categories';
import { durationOptions } from '@/lib/duration';
import { CategoryId, DurationTier, Scene, AffiliateInput, TTSProviderId, CartesiaSettings, ElevenLabsSettings, GTTSSettings, AffiliateProductBasic } from '@/lib/types';
import CategoryGrid from '@/components/CategoryGrid';
import MoodBadge from '@/components/MoodBadge';
import StatusMessage from '@/components/StatusMessage';
import TopicInput from '@/components/TopicInput';
import AffiliateForm from '@/components/AffiliateForm';
import DurationSelect from '@/components/DurationSelect';
import ScriptResult from '@/components/ScriptResult';
import AudioPanel from '@/components/AudioPanel';
import SceneList from '@/components/SceneList';
// getCategoryEmoji import removed — no longer needed

export default function Home() {
  // Input state
  const [category, setCategory] = useState<CategoryId | ''>('');
  const [topic, setTopic] = useState('');
  const [nicheName, setNicheName] = useState(''); // Untuk kategori custom
  const [duration, setDuration] = useState<DurationTier | ''>('');
  const [ideaMode, setIdeaMode] = useState<'manual' | 'trending'>('manual');
  const [ideasList, setIdeasList] = useState<string[]>([]);
  const [isLoadingIdeas, setIsLoadingIdeas] = useState(false);
  const [selectedIdea, setSelectedIdea] = useState<string | null>(null);
  const [trendingFailed, setTrendingFailed] = useState(false);
  const [affiliateInput, setAffiliateInput] = useState<AffiliateInput>({
    productName: '', productDescription: '', productPrice: '', productRating: undefined,
  });
  const [comparisonProducts, setComparisonProducts] = useState<AffiliateProductBasic[]>([]);

  // Result state
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [failedSegment, setFailedSegment] = useState<number | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [progressSeg, setProgressSeg] = useState<{ current: number; total: number } | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
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

  const formRef = useRef<HTMLDivElement>(null);
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
  const isComparisonMode = isAffiliate && duration === 'long';

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
        productName: affiliateInput.productName,
        productDescription: affiliateInput.productDescription,
        productPrice: affiliateInput.productPrice || undefined,
        productRating: affiliateInput.productRating || undefined,
        comparisonProducts: isComparisonMode && comparisonProducts.length > 0 ? comparisonProducts : undefined,
      } : undefined;

      const response = await fetch('/api/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          topic,
          duration,
          affiliateInput: affInput,
          nicheName: category === 'custom' ? nicheName : undefined,
        }),
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
    if (ideaMode === 'manual') {
      setIdeasList([]);
      return;
    }

    // Mode trending: fetch dari API
    let cancelled = false;
    setIsLoadingIdeas(true);
    setIdeasList([]);
    setTrendingFailed(false);

    const timer = setTimeout(() => {
      const fetchIdeas = async () => {
        try {
          const res = await fetch(`/api/trending-ideas?category=${encodeURIComponent(category)}`);
          const data = await res.json();
          console.log('[Ideas] Trending response:', data);
          if (!cancelled && data.success && Array.isArray(data.ideas) && data.ideas.length > 0) {
            console.log('[Ideas] Setting ideasList from trending:', data.ideas);
            setIdeasList(data.ideas);
            setIsLoadingIdeas(false);
            return;
          }
          if (!cancelled) {
            setTrendingFailed(true);
            setIdeasList([]);
          }
        } catch (e) {
          console.error('Gagal fetch ideas:', e);
          if (!cancelled) {
            setTrendingFailed(true);
            setIdeasList([]);
          }
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
    setAffiliateInput({ productName: '', productDescription: '', productPrice: '', productRating: undefined });
    setComparisonProducts([]);
    setIdeaMode('manual');
    setIdeasList([]);
    setSelectedIdea(null);
  };

  const handleIdeaClick = (idea: string) => {
    setSelectedIdea(idea);
    setTopic(idea);
  };

  const handleAddComparisonProduct = () => {
    if (comparisonProducts.length < 3) {
      setComparisonProducts([...comparisonProducts, { productName: '', productDescription: '', productPrice: '', productRating: undefined }]);
    }
  };

  const handleRemoveComparisonProduct = (index: number) => {
    setComparisonProducts(comparisonProducts.filter((_, i) => i !== index));
  };

  const handleComparisonProductChange = (index: number, field: keyof AffiliateProductBasic, value: string | number | undefined) => {
    const updated = [...comparisonProducts];
    updated[index] = { ...updated[index], [field]: value };
    setComparisonProducts(updated);
  };

  // Desktop auto-scroll ke form detail setelah kategori dipilih
  useEffect(() => {
    if (category && formRef.current && window.innerWidth >= 768) {
      const timer = setTimeout(() => {
        formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [category]);

  return (
    <div className="space-y-6">
      {/* ===== BAGIAN ATAS: INPUT ===== */}
      <div className="card space-y-4">
        {/* Headline */}
        <div className="text-center space-y-1">
          <h1 className="text-xl font-bold">Buat Skrip Video Viral + Suara AI dalam 30 Detik 🚀</h1>
          <p className="text-sm text-[var(--muted-foreground)]">Pilih kategori, masukkan ide, langsung generate.</p>
        </div>

        {/* Kategori — grid 3x3 preset + custom card */}
        <CategoryGrid
          selectedCategory={category}
          hasResult={hasResult}
          onSelectCategory={(id) => { setCategory(id); setIdeaMode('manual'); setIdeasList([]); setSelectedIdea(null); setTrendingFailed(false); setTopic(''); setScenes([]); setAudioUrl(null); }}
        />

        {/* Form yang muncul setelah kategori dipilih — smooth appear */}
        {category && (
        <div ref={formRef} className="transition-all duration-300 ease-in-out animate-[fadeSlideUp_0.3s_ease-out] space-y-4">
          <TopicInput
            topic={topic}
            ideaMode={ideaMode}
            ideasList={ideasList}
            selectedIdea={selectedIdea}
            isLoadingIdeas={isLoadingIdeas}
            trendingFailed={trendingFailed}
            hasResult={hasResult}
            category={category}
            nicheName={nicheName}
            onTopicChange={(value) => setTopic(value)}
            onManualClick={() => { setIdeaMode('manual'); setSelectedIdea(null); }}
            onTrendingClick={() => { setIdeaMode('trending'); setSelectedIdea(null); setTopic(''); setTrendingFailed(false); setIdeasList([]); }}
            onSelectIdea={(idea) => handleIdeaClick(idea)}
            onNicheNameChange={(value) => setNicheName(value)}
          />

          {isAffiliate && (
            <AffiliateForm
              affiliateInput={affiliateInput}
              isComparisonMode={isComparisonMode}
              comparisonProducts={comparisonProducts}
              hasResult={hasResult}
              onAffiliateInputChange={(input) => setAffiliateInput(input)}
              onAddComparisonProduct={handleAddComparisonProduct}
              onRemoveComparisonProduct={handleRemoveComparisonProduct}
              onComparisonProductChange={handleComparisonProductChange}
            />
          )}

          <DurationSelect
            duration={duration}
            hasResult={hasResult}
            category={category}
            onDurationChange={(value) => setDuration(value)}
          />

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
            <StatusMessage variant="warning">
              ⏹️ Proses dibatalkan
            </StatusMessage>
          )}

          {/* Error */}
          {errorMessage && (
            <StatusMessage variant="error">
              {errorMessage}
            </StatusMessage>
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
          <ScriptResult
            scenes={scenes}
            failedSegment={failedSegment}
            fullNarration={fullNarration}
            copied={copied}
            textAreaRef={textAreaRef as React.RefObject<HTMLTextAreaElement>}
            onCopyText={handleCopyText}
          />

          <AudioPanel
            scenes={scenes}
            ttsProvider={ttsProvider}
            cartesiaSettings={cartesiaSettings}
            elevenSettings={elevenSettings}
            googleSettings={googleSettings}
            isGeneratingAudio={isGeneratingAudio}
            audioProgress={audioProgress}
            audioUrl={audioUrl}
            audioError={audioError}
            isPreviewing={isPreviewing}
            previewAudioUrl={previewAudioUrl}
            previewAudioError={previewAudioError}
            isInstantPreviewing={isInstantPreviewing}
            onTtsProviderChange={(provider) => { setTtsProvider(provider); setAudioUrl(null); setAudioError(''); }}
            onCartesiaSettingsChange={(settings) => setCartesiaSettings(settings)}
            onElevenSettingsChange={(settings) => setElevenSettings(settings)}
            onGoogleSettingsChange={(settings) => setGoogleSettings(settings)}
            onInstantPreview={handleInstantPreview}
            onPreviewAudio={handlePreviewAudio}
            onGenerateAudio={handleGenerateAudio}
          />

          <SceneList
            scenes={scenes}
            expandedScene={expandedScene}
            onToggleExpand={(i) => setExpandedScene(expandedScene === i ? null : i)}
          />
        </div>
      )}
    </div>
  );
}