'use client';

import { useEffect, useState } from 'react';

// ===== Types =====
interface Category {
  id: string;
  slug: string;
  name: string;
}

interface PatternInsight {
  id: string;
  category_id: string;
  pattern_key: string;
  pattern_value: string;
  avg_view_count: number | null;
  sample_count: number | null;
  low_confidence: boolean;
  computed_at: string;
}

interface TopVideo {
  id: string;
  title: string;
  view_count: number | null;
  duration_seconds: number | null;
  external_id: string;
  captured_at: string;
}

interface CrawlProgress {
  raw: Array<{ category_id: string; captured_at: string }>;
  grouped: Record<string, Record<string, number>>;
}

interface InsightsData {
  categories: Category[];
  patternInsights: PatternInsight[];
  crawlProgress: CrawlProgress;
  topVideos: Record<string, TopVideo[]>;
  baselines: Record<string, number>;
  narratives: Record<string, string>;
}

// ===== Helpers =====
const CATEGORY_EMOJIS: Record<string, string> = {
  horror: '👻', psikologi: '🧠', romance: '💕',
  motivasi: '🔥', edukasi: '📚', affiliate: '🛒',
};

const CATEGORY_COLORS: Record<string, string> = {
  horror: '#ef4444', psikologi: '#8b5cf6', romance: '#ec4899',
  motivasi: '#f97316', edukasi: '#3b82f6', affiliate: '#22c55e',
};

function formatNumber(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'jt';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'rb';
  return n.toLocaleString('id-ID');
}

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function getLast7Days(): string[] {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }
  return days;
}

// Pattern keys display labels
const patternKeyLabels: Record<string, string> = {
  hook_type: 'Hook Type',
  duration_bucket: 'Durasi Video',
  title_length_bucket: 'Panjang Judul',
};

// ===== Insight Narrative Component =====

function InsightNarrative({
  narrative,
}: {
  narrative: string;
}) {
  if (!narrative) return null;
  return (
    <div className="bg-gradient-to-r from-blue-600/10 to-purple-600/10 border border-blue-500/20 rounded-xl p-5 space-y-2">
      <h2 className="text-lg font-bold flex items-center gap-2">
        <span>💡</span> Insight
      </h2>
      <p className="text-sm text-gray-300 leading-relaxed">
        {narrative}
      </p>
    </div>
  );
}

// ===== Sub-components =====

function PatternSection({
  cat,
  patterns,
  baseline,
}: {
  cat: Category;
  patterns: PatternInsight[];
  baseline: number;
}) {
  // Group by pattern_key
  const groupedByKey: Record<string, PatternInsight[]> = {};
  for (const p of patterns) {
    if (!groupedByKey[p.pattern_key]) groupedByKey[p.pattern_key] = [];
    groupedByKey[p.pattern_key].push(p);
  }

  if (patterns.length === 0) {
    return (
      <div className="bg-[#1a1a1a] border border-[#333] rounded-xl p-5">
        <p className="text-sm text-gray-500">Belum ada data pattern untuk kategori ini. Jalankan cron job analyze-patterns terlebih dahulu.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{CATEGORY_EMOJIS[cat.slug] || '📁'}</span>
        <div>
          <h2 className="text-lg font-bold">{cat.name}</h2>
          <p className="text-xs text-gray-500">
            Baseline avg views: <span className="text-white font-medium">{formatNumber(baseline)}</span>
          </p>
        </div>
      </div>

      {Object.entries(groupedByKey).map(([key, insights]) => (
        <div key={key} className="bg-[#1a1a1a] border border-[#333] rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
            {patternKeyLabels[key] || key}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-800">
                  <th className="text-left py-2 pr-4">Pattern Value</th>
                  <th className="text-right py-2 px-2">Avg Views</th>
                  <th className="text-right py-2 px-2">Sample</th>
                  <th className="text-center py-2 pl-2">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {insights.map(p => (
                  <tr key={p.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                    <td className="py-2 pr-4 font-medium">{p.pattern_value}</td>
                    <td className="text-right py-2 px-2 font-mono" style={{ color: (p.avg_view_count || 0) >= baseline ? '#22c55e' : '#ef4444' }}>
                      {formatNumber(p.avg_view_count)}
                    </td>
                    <td className="text-right py-2 px-2 text-gray-400 font-mono">{p.sample_count ?? '—'}</td>
                    <td className="text-center py-2 pl-2">
                      {p.low_confidence ? (
                        <span className="inline-block text-[10px] bg-yellow-600/20 text-yellow-400 px-2 py-0.5 rounded-full font-medium">
                          ⚠️ Low
                        </span>
                      ) : (
                        <span className="inline-block text-[10px] bg-green-600/20 text-green-400 px-2 py-0.5 rounded-full font-medium">
                          ✅ High
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

function ProgressSection({
  categories,
  crawlProgress,
  days,
}: {
  categories: Category[];
  crawlProgress: CrawlProgress;
  days: string[];
}) {
  return (
    <div className="bg-[#1a1a1a] border border-[#333] rounded-xl p-5 space-y-4">
      <h2 className="text-lg font-bold">📈 Progress Crawl (7 Hari Terakhir)</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500 border-b border-gray-800">
              <th className="text-left py-2 pr-4">Kategori</th>
              {days.map(d => {
                const [, m, day] = d.split('-');
                return (
                  <th key={d} className="text-center py-2 px-1 min-w-[60px]">
                    <div>{day}/{m}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {categories.map(cat => {
              const catGroup = crawlProgress.grouped[cat.id] || {};
              return (
                <tr key={cat.id} className="border-b border-gray-800/50">
                  <td className="py-2 pr-4 font-medium">
                    <span className="mr-1">{CATEGORY_EMOJIS[cat.slug] || '📁'}</span>
                    {cat.name}
                  </td>
                  {days.map(d => {
                    const count = catGroup[d] || 0;
                    return (
                      <td key={d} className="text-center py-2 px-1">
                        <span className={`font-mono text-xs ${count > 0 ? 'text-green-400' : 'text-gray-600'}`}>
                          {count > 0 ? count : '—'}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TopVideosSection({
  categories,
  topVideos,
  activeCatId,
}: {
  categories: Category[];
  topVideos: Record<string, TopVideo[]>;
  activeCatId: string;
}) {
  const cat = categories.find(c => c.id === activeCatId);
  if (!cat) return null;
  const videos = topVideos[cat.id] || [];

  return (
    <div className="bg-[#1a1a1a] border border-[#333] rounded-xl p-5 space-y-4">
      <h2 className="text-lg font-bold">🏆 Top 5 Videos — {cat.name}</h2>
      {videos.length === 0 ? (
        <p className="text-xs text-gray-600">Belum ada data video.</p>
      ) : (
        <div className="space-y-2">
          {videos.map((v, i) => (
            <div key={v.id} className="flex items-start gap-3 text-sm border-b border-gray-800/50 pb-3 last:border-0">
              <span className="text-gray-500 font-mono w-5 flex-shrink-0 text-center text-xs">#{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-white truncate font-medium">{v.title}</p>
                <div className="flex gap-4 mt-1 text-xs text-gray-500">
                  <span>👁️ {formatNumber(v.view_count)}</span>
                  <span>⏱️ {formatDuration(v.duration_seconds)}</span>
                </div>
              </div>
              {v.external_id && (
                <a
                  href={`https://www.youtube.com/watch?v=${v.external_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 flex-shrink-0 text-lg"
                  title="Buka di YouTube"
                >
                  ▶️
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===== Main Component =====
export default function AdminInsightsPage() {
  const [data, setData] = useState<InsightsData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [secret, setSecret] = useState('');
  const [authed, setAuthed] = useState(false);
  const [activeTab, setActiveTab] = useState<string | null>(null);

  // Try fetching with secret from URL param on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const s = params.get('secret');
    if (s) {
      setSecret(s);
      fetchData(s);
    } else {
      fetchData('');
    }
  }, []);

  async function fetchData(s: string) {
    setLoading(true);
    setError('');
    try {
      const url = s ? `/api/admin/insights?secret=${encodeURIComponent(s)}` : '/api/admin/insights';
      const res = await fetch(url);
      if (res.status === 401) {
        setAuthed(false);
        setLoading(false);
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const json: InsightsData = await res.json();
      setData(json);
      setAuthed(true);
      // Set active tab to first category
      if (json.categories.length > 0) {
        setActiveTab(json.categories[0].id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  }

  function handleAuth() {
    if (!secret.trim()) return;
    fetchData(secret.trim());
  }

  // ===== Unauthenticated state =====
  if (!authed && !loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f0f0f] p-4">
        <div className="bg-[#1a1a1a] border border-[#333] rounded-xl p-8 max-w-md w-full space-y-4">
          <div className="text-center">
            <span className="text-4xl">🔐</span>
            <h1 className="text-xl font-bold text-white mt-2">Admin Insights</h1>
            <p className="text-sm text-gray-400 mt-1">Masukkan API Secret Key untuk mengakses dashboard</p>
          </div>
          <div className="space-y-3">
            <input
              className="w-full px-4 py-2 rounded-lg bg-[#222] border border-[#444] text-white text-sm focus:outline-none focus:border-blue-500"
              placeholder="API_SECRET_KEY"
              type="password"
              value={secret}
              onChange={e => setSecret(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAuth()}
            />
            <button
              className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
              onClick={handleAuth}
              disabled={!secret.trim()}
            >
              🔓 Buka Dashboard
            </button>
          </div>
          {error && (
            <div className="text-sm text-red-400 bg-red-900/20 p-3 rounded-lg border border-red-800">
              ❌ {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ===== Loading =====
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f0f0f]">
        <div className="flex items-center gap-3 text-gray-400">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Memuat data insights...</span>
        </div>
      </div>
    );
  }

  // ===== Error =====
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f0f0f] p-4">
        <div className="text-sm text-red-400 bg-red-900/20 p-4 rounded-lg border border-red-800 max-w-md">
          ❌ {error}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { categories, patternInsights, crawlProgress, topVideos, baselines, narratives } = data;
  const days = getLast7Days();

  // Ensure activeTab is valid
  const validActiveTab = activeTab && categories.some(c => c.id === activeTab)
    ? activeTab
    : categories.length > 0 ? categories[0].id : null;

  const activeCat = categories.find(c => c.id === validActiveTab);
  const activePatterns = patternInsights.filter(p => p.category_id === validActiveTab);

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white">
      {/* ===== FULL WIDTH CONTAINER ===== */}
      <div className="w-full px-4 md:px-8 lg:px-12 py-6 space-y-6">
        {/* ===== HEADER ===== */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">📊 Admin Insights</h1>
            <p className="text-sm text-gray-400 mt-1">Dashboard pattern & progress — read-only</p>
          </div>
          <button
            className="text-xs text-gray-500 hover:text-gray-300 px-3 py-1.5 rounded-lg border border-gray-700 transition-colors"
            onClick={() => window.location.reload()}
          >
            🔄 Refresh
          </button>
        </div>

        {/* ===== SUMMARY CARDS — FULL WIDTH GRID ===== */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {categories.map(cat => {
            const catInsights = patternInsights.filter(p => p.category_id === cat.id);
            const catSamples = crawlProgress.raw.filter(r => r.category_id === cat.id).length;
            return (
              <div key={cat.id} className="bg-[#1a1a1a] border border-[#333] rounded-xl p-4 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{CATEGORY_EMOJIS[cat.slug] || '📁'}</span>
                  <span className="font-semibold text-sm">{cat.name}</span>
                </div>
                <div className="text-2xl font-bold" style={{ color: CATEGORY_COLORS[cat.slug] || '#888' }}>
                  {catInsights.length}
                </div>
                <div className="text-xs text-gray-500">pattern insights</div>
                <div className="text-xs text-gray-500">{catSamples} samples (7 hari)</div>
                <div className="text-xs text-gray-500">
                  Baseline: <span className="text-gray-300 font-medium">{formatNumber(baselines[cat.id])}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* ===== TAB BAR — 6 KATEGORI HORIZONTAL ===== */}
        <div className="flex flex-wrap gap-1 border-b border-gray-800 pb-0">
          {categories.map(cat => {
            const isActive = validActiveTab === cat.id;
            const color = CATEGORY_COLORS[cat.slug] || '#888';
            return (
              <button
                key={cat.id}
                onClick={() => setActiveTab(cat.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-t-lg transition-all border-b-2 -mb-[1px] ${
                  isActive
                    ? 'bg-[#1a1a1a] text-white border-b-2'
                    : 'text-gray-500 hover:text-gray-300 border-b-transparent hover:border-b-gray-600'
                }`}
                style={{
                  borderBottomColor: isActive ? color : undefined,
                }}
              >
                <span>{CATEGORY_EMOJIS[cat.slug] || '📁'}</span>
                <span>{cat.name}</span>
                {isActive && (
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* ===== TAB CONTENT ===== */}
        {validActiveTab && activeCat && (
          <div className="space-y-6">
            {/* 💡 Insight Narrative — di atas tabel pattern */}
            <InsightNarrative narrative={narratives[activeCat.id] || ''} />

            {/* Pattern Insights */}
            <PatternSection
              cat={activeCat}
              patterns={activePatterns}
              baseline={baselines[activeCat.id] || 0}
            />

            {/* Progress Crawl */}
            <ProgressSection
              categories={categories}
              crawlProgress={crawlProgress}
              days={days}
            />

            {/* Top Videos */}
            <TopVideosSection
              categories={categories}
              topVideos={topVideos}
              activeCatId={validActiveTab}
            />
          </div>
        )}

        {/* ===== FOOTER ===== */}
        <div className="text-center text-xs text-gray-600 pb-4">
          Admin Dashboard ViraLoop — Data bersifat read-only. Refresh halaman untuk data terbaru.
        </div>
      </div>
    </div>
  );
}