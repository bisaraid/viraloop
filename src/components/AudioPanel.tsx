'use client';

import { Scene, TTSProviderId, CartesiaSettings, ElevenLabsSettings, GTTSSettings } from '@/lib/types';
import { useRef } from 'react';
import StatusMessage from '@/components/StatusMessage';

interface AudioPanelProps {
  scenes: Scene[];
  ttsProvider: TTSProviderId;
  cartesiaSettings: CartesiaSettings;
  elevenSettings: ElevenLabsSettings;
  googleSettings: GTTSSettings;
  isGeneratingAudio: boolean;
  audioProgress: string;
  audioUrl: string | null;
  audioError: string;
  isPreviewing: boolean;
  previewAudioUrl: string | null;
  previewAudioError: string;
  isInstantPreviewing: boolean;
  onTtsProviderChange: (provider: TTSProviderId) => void;
  onCartesiaSettingsChange: (settings: CartesiaSettings) => void;
  onElevenSettingsChange: (settings: ElevenLabsSettings) => void;
  onGoogleSettingsChange: (settings: GTTSSettings) => void;
  onInstantPreview: () => void;
  onPreviewAudio: () => void;
  onGenerateAudio: () => void;
}

export default function AudioPanel({
  scenes,
  ttsProvider,
  cartesiaSettings,
  elevenSettings,
  googleSettings,
  isGeneratingAudio,
  audioProgress,
  audioUrl,
  audioError,
  isPreviewing,
  previewAudioUrl,
  previewAudioError,
  isInstantPreviewing,
  onTtsProviderChange,
  onCartesiaSettingsChange,
  onElevenSettingsChange,
  onGoogleSettingsChange,
  onInstantPreview,
  onPreviewAudio,
  onGenerateAudio,
}: AudioPanelProps) {
  const audioRef = useRef<HTMLAudioElement>(null);

  return (
    <div className="card space-y-4">
      <h3 className="font-semibold">🔊 Konversi ke Audio</h3>

      {/* Pilih Provider */}
      <div>
        <label className="label">Provider Suara</label>
        <select className="select-field" value={ttsProvider}
          onChange={(e) => { onTtsProviderChange(e.target.value as TTSProviderId); }}>
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
              onChange={(e) => onCartesiaSettingsChange({ ...cartesiaSettings, voice_id: e.target.value })}>
              <option value="">Default (dari API key)</option>
              <option value="andi">Andi</option>
              <option value="siti">Siti</option>
            </select>
          </div>
          <div>
            <label className="label">Speed: {cartesiaSettings.speed.toFixed(1)}x</label>
            <input type="range" min="0.6" max="1.5" step="0.1" className="slider-field"
              value={cartesiaSettings.speed}
              onChange={(e) => onCartesiaSettingsChange({ ...cartesiaSettings, speed: parseFloat(e.target.value) })} />
            <div className="flex justify-between text-xs text-[var(--muted-foreground)]">
              <span>0.6x (lambat)</span><span>1.5x (cepat)</span>
            </div>
          </div>
          <div>
            <label className="label">Emotion (opsional)</label>
            <select className="select-field" value={cartesiaSettings.emotion || ''}
              onChange={(e) => onCartesiaSettingsChange({ ...cartesiaSettings, emotion: e.target.value || undefined })}>
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
              onChange={(e) => onElevenSettingsChange({ ...elevenSettings, stability: parseFloat(e.target.value) })} />
          </div>
          <div>
            <label className="label">Similarity Boost: {elevenSettings.similarity_boost.toFixed(2)}</label>
            <input type="range" min="0" max="1" step="0.05" className="slider-field"
              value={elevenSettings.similarity_boost}
              onChange={(e) => onElevenSettingsChange({ ...elevenSettings, similarity_boost: parseFloat(e.target.value) })} />
          </div>
          <div>
            <label className="label">Style: {elevenSettings.style.toFixed(2)}</label>
            <input type="range" min="0" max="1" step="0.05" className="slider-field"
              value={elevenSettings.style}
              onChange={(e) => onElevenSettingsChange({ ...elevenSettings, style: parseFloat(e.target.value) })} />
          </div>
          <div>
            <label className="label">Speed: {elevenSettings.speed.toFixed(1)}x</label>
            <input type="range" min="0.5" max="2" step="0.1" className="slider-field"
              value={elevenSettings.speed}
              onChange={(e) => onElevenSettingsChange({ ...elevenSettings, speed: parseFloat(e.target.value) })} />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="speakerBoost" checked={elevenSettings.use_speaker_boost}
              onChange={(e) => onElevenSettingsChange({ ...elevenSettings, use_speaker_boost: e.target.checked })} />
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
              onChange={(e) => onGoogleSettingsChange({ ...googleSettings, lang: e.target.value })}>
              <option value="id">Bahasa Indonesia</option>
              <option value="en">English</option>
              <option value="ja">Japanese</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="slowMode" checked={googleSettings.slow}
              onChange={(e) => onGoogleSettingsChange({ ...googleSettings, slow: e.target.checked })} />
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
          <div className="flex gap-2 flex-wrap">
            <button className="btn-secondary text-sm flex-[0.3]"
              disabled={scenes.length === 0 || isInstantPreviewing}
              onClick={onInstantPreview}>
              {isInstantPreviewing ? '🔊 ...' : '⚡ Instant'}
            </button>
            <button className="btn-secondary flex-[0.3]"
              disabled={scenes.length === 0 || isPreviewing}
              onClick={onPreviewAudio}>
              {isPreviewing ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-3 h-3 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
                  Preview...
                </span>
              ) : '🔊 Preview'}
            </button>
            <button className="btn-primary flex-[0.4]"
              disabled={scenes.length === 0}
              onClick={onGenerateAudio}>
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
        <StatusMessage variant="error">
          {previewAudioError}
        </StatusMessage>
      )}

      {audioError && (
        <StatusMessage variant="error">
          {audioError}
        </StatusMessage>
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
  );
}