'use client';

import { useState, useRef, useCallback } from 'react';
import { allCategories } from '@/lib/categories';
import { durationOptions } from '@/lib/duration';
import { CategoryId, DurationTier, Scene, AffiliateInput, TTSProviderId, CartesiaSettings, ElevenLabsSettings, GTTSSettings } from '@/lib/types';

export default function Home() {
  // Input state
  const [category, setCategory] = useState<CategoryId | ''>('');
  const [topic, setTopic] = useState('');
  const [duration, setDuration] = useState<DurationTier | ''>('');
  const [affiliateInput, setAffiliateInput] = useState<AffiliateInput>({
    productUrl: '', productDescription: '', reviews: [''],
  });

  // Result state
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [failedSegment, setFailedSegment] = useState<number | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [progressSeg, setProgressSeg] = useState<{ current: number; total: number } | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [expandedScene, setExpandedScene] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

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

  const audioRef = useRef<HTMLAudioElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const selectedCategory = allCategories.find(c => c.id === category);
  const isAffiliate = category === 'affiliate';
  const hasResult = scenes.length > 0;

  const fullNarration = scenes.map(s => s.narration).join('\n\n');

  const handleGenerate = async () => {
    if (!category || !topic || !duration) return;
    setIsGenerating(true);
    setProgressMsg('Membuat outline cerita...');
    setScenes([]);
    setAudioUrl(null);
    setErrorMessage('');

    try {
      const affInput: AffiliateInput | undefined = isAffiliate ? {
        productUrl: affiliateInput.productUrl || undefined,
        productDescription: affiliateInput.productDescription,
        reviews: affiliateInput.reviews.filter(r => r.trim().length > 0),
      } : undefined;

      const response = await fetch('/api/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, topic, duration, affiliateInput: affInput }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Gagal generate script');

      setScenes(data.scenes);
      setFailedSegment(data.failedSegment);
      setProgressMsg('Script selesai!');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Terjadi kesalahan');
    } finally {
      setIsGenerating(false);
      setProgressSeg(null);
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

      const response = await fetch('/api/generate-tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenes, provider: ttsProvider, settings }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Gagal generate audio (${response.status})`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
    } catch (error) {
      setAudioError(error instanceof Error ? error.message : 'Gagal generate audio');
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const getCategoryEmoji = (id: string) => {
    const map: Record<string, string> = {
      horror: '👻', psychology: '🧠', romance: '💕',
      motivation: '🔥', education: '📚', affiliate: '🛍️',
    };
    return map[id] || '📝';
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

  return (
    <div className="space-y-6">
      {/* ===== BAGIAN ATAS: INPUT ===== */}
      <div className="card space-y-4">
        <h2 className="text-lg font-semibold">Buat Script Video</h2>

        {/* Kategori */}
        <div>
          <label className="label">Kategori Konten</label>
          <select
            className="select-field"
            value={category}
            onChange={(e) => { setCategory(e.target.value as CategoryId); setScenes([]); setAudioUrl(null); }}
          >
            <option value="">— Pilih Kategori —</option>
            {allCategories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {getCategoryEmoji(cat.id)} {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Topik */}
        {category && !isAffiliate && (
          <div>
            <label className="label">Judul / Ide Topik</label>
            <input
              className="input-field"
              placeholder="Contoh: Kisah angker di rumah sakit tua"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
          </div>
        )}

        {/* Affiliate form */}
        {category && isAffiliate && (
          <div className="space-y-3">
            <div>
              <label className="label">URL Produk (opsional)</label>
              <input className="input-field" placeholder="https://tokopedia.com/..." value={affiliateInput.productUrl}
                onChange={(e) => setAffiliateInput({ ...affiliateInput, productUrl: e.target.value })} />
            </div>
            <div>
              <label className="label">Deskripsi Produk <span className="text-red-400">*</span></label>
              <textarea className="textarea-field" placeholder="Jelaskan produk ini secara detail..." rows={3}
                value={affiliateInput.productDescription}
                onChange={(e) => setAffiliateInput({ ...affiliateInput, productDescription: e.target.value })} />
            </div>
            <div>
              <label className="label">Ulasan Produk <span className="text-red-400">* (min 1)</span></label>
              {affiliateInput.reviews.map((review, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <textarea className="textarea-field" placeholder={`Ulasan ${i + 1}...`} rows={2}
                    value={review}
                    onChange={(e) => {
                      const r = [...affiliateInput.reviews]; r[i] = e.target.value;
                      setAffiliateInput({ ...affiliateInput, reviews: r });
                    }} />
                  {affiliateInput.reviews.length > 1 && (
                    <button onClick={() => setAffiliateInput({ ...affiliateInput, reviews: affiliateInput.reviews.filter((_, j) => j !== i) })}
                      className="text-red-400 text-sm self-start mt-2">Hapus</button>
                  )}
                </div>
              ))}
              <button onClick={() => setAffiliateInput({ ...affiliateInput, reviews: [...affiliateInput.reviews, ''] })}
                className="text-sm text-[var(--primary)]">+ Tambah ulasan</button>
            </div>
          </div>
        )}

        {/* Durasi */}
        {category && (
          <div>
            <label className="label">Durasi Konten</label>
            <select className="select-field" value={duration}
              onChange={(e) => setDuration(e.target.value as DurationTier)}>
              <option value="">— Pilih Durasi —</option>
              {durationOptions.map((d) => (
                <option key={d.id} value={d.id}>{d.label} — {d.description}</option>
              ))}
            </select>
          </div>
        )}

        {/* Tombol Generate */}
        <button className="btn-primary w-full text-base py-3"
          disabled={!category || !topic || !duration || isGenerating}
          onClick={handleGenerate}>
          {isGenerating ? '⏳ Generating...' : '🚀 Generate Script'}
        </button>

        {/* Progress */}
        {isGenerating && (
          <div className="text-sm text-[var(--muted-foreground)] flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
            {progressMsg}
          </div>
        )}

        {/* Error */}
        {errorMessage && (
          <div className="text-sm text-red-400 bg-red-900/20 p-3 rounded-lg border border-red-800">
            ❌ {errorMessage}
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
                  <label className="label">Voice ID</label>
                  <input className="input-field" placeholder="Masukkan Voice ID Cartesia"
                    value={cartesiaSettings.voice_id}
                    onChange={(e) => setCartesiaSettings({ ...cartesiaSettings, voice_id: e.target.value })} />
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
                  <label className="label">Voice ID</label>
                  <input className="input-field" placeholder="Masukkan Voice ID ElevenLabs"
                    value={elevenSettings.voice_id}
                    onChange={(e) => setElevenSettings({ ...elevenSettings, voice_id: e.target.value })} />
                </div>
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

            {/* Tombol Generate Audio */}
            <button className="btn-primary w-full"
              disabled={isGeneratingAudio || scenes.length === 0}
              onClick={handleGenerateAudio}>
              {isGeneratingAudio ? '⏳ Generating Audio...' : '🎵 Generate Audio'}
            </button>

            {audioError && (
              <div className="text-sm text-red-400 bg-red-900/20 p-3 rounded-lg border border-red-800">
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