/**
 * Reddit OAuth Client — Client Credentials Flow (Script App)
 *
 * Prasyarat (dilakukan MANUAL oleh user):
 *   1. Daftar app di https://www.reddit.com/prefs/apps (tipe: script)
 *   2. Dapatkan REDDIT_CLIENT_ID dan REDDIT_CLIENT_SECRET
 *   3. Tambahkan ke .env
 *
 * Rate limit: 60 requests/menit untuk OAuth script app (resmi).
 * Crawler ini menghormati rate limit dengan jeda antar request.
 *
 * Pemetaan subreddit per kategori:
 *   - horror     → r/nosleep, r/UnresolvedMysteries
 *   - psikologi  → r/psychology, r/AcademicPsychology
 *   - romance    → r/relationship_advice, r/LongDistance
 *   - motivasi   → r/GetMotivated, r/selfimprovement
 *   - edukasi    → r/educationalgifs, r/YouShouldKnow
 *   - misteri    → r/UnresolvedMysteries, r/HighStrangeness
 *   - sejarah    → r/history, r/AskHistorians
 *   - keuangan   → r/personalfinance, r/investing
 */

interface RedditTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface RedditPost {
  title: string;
  score: number;
  url: string;
  subreddit: string;
  num_comments: number;
  created_utc: number;
}

interface RedditApiResponse {
  data?: {
    children?: Array<{
      data: {
        title: string;
        score: number;
        url: string;
        subreddit: string;
        num_comments: number;
        created_utc: number;
      };
    }>;
  };
  error?: number;
  message?: string;
}

// ============================================================
// PEMETAAN SUBREDDIT PER KATEGORI
// ============================================================

export const CATEGORY_SUBREDDITS: Record<string, string[]> = {
  horror: ['nosleep', 'UnresolvedMysteries'],
  psikologi: ['psychology', 'AcademicPsychology'],
  romance: ['relationship_advice', 'LongDistance'],
  motivasi: ['GetMotivated', 'selfimprovement'],
  edukasi: ['educationalgifs', 'YouShouldKnow'],
  misteri: ['UnresolvedMysteries', 'HighStrangeness'],
  sejarah: ['history', 'AskHistorians'],
  keuangan: ['personalfinance', 'investing'],
};

// ============================================================
// REDDIT OAUTH CLIENT
// ============================================================

const REDDIT_API_BASE = 'https://oauth.reddit.com';
const REDDIT_AUTH_BASE = 'https://www.reddit.com';

export class RedditClient {
  private clientId: string;
  private clientSecret: string;
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;
  private userAgent: string;

  constructor() {
    this.clientId = process.env.REDDIT_CLIENT_ID || '';
    this.clientSecret = process.env.REDDIT_CLIENT_SECRET || '';
    this.userAgent = 'ViraLoop/1.0 (by /u/viraloop_bot)';

    if (!this.clientId || !this.clientSecret) {
      console.warn('[RedditClient] REDDIT_CLIENT_ID atau REDDIT_CLIENT_SECRET tidak diset. Reddit crawler tidak akan berfungsi.');
    }
  }

  /**
   * Cek apakah kredensial sudah diset
   */
  isConfigured(): boolean {
    return !!(this.clientId && this.clientSecret);
  }

  /**
   * Dapatkan OAuth access token via Client Credentials flow
   */
  private async getAccessToken(): Promise<string> {
    // Jika token masih valid, return cached
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    if (!this.clientId || !this.clientSecret) {
      throw new Error('Reddit credentials not configured');
    }

    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

    const response = await fetch(`${REDDIT_AUTH_BASE}/api/v1/access_token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': this.userAgent,
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Reddit OAuth gagal (HTTP ${response.status}): ${errorText}`);
    }

    const data: RedditTokenResponse = await response.json();
    this.accessToken = data.access_token;
    // Set expiry 60 detik sebelum benar-benar expired untuk safety
    this.tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;

    return this.accessToken!;
  }

  /**
   * Fetch top posts dari subreddit tertentu
   * @param subreddit Nama subreddit (tanpa r/)
   * @param timeFilter 'day' | 'week' | 'month' | 'year' | 'all'
   * @param limit Jumlah post (max 100)
   */
  async getTopPosts(
    subreddit: string,
    timeFilter: 'day' | 'week' | 'month' | 'year' | 'all' = 'day',
    limit: number = 10
  ): Promise<RedditPost[]> {
    try {
      const token = await this.getAccessToken();

      const url = new URL(`${REDDIT_API_BASE}/r/${subreddit}/top`);
      url.searchParams.set('t', timeFilter);
      url.searchParams.set('limit', String(Math.min(limit, 100)));

      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-Agent': this.userAgent,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`[RedditClient] GET /r/${subreddit}/top gagal (HTTP ${response.status}): ${errorText}`);
        return [];
      }

      const data: RedditApiResponse = await response.json();

      if (data.error) {
        console.warn(`[RedditClient] Reddit API error untuk /r/${subreddit}: ${data.message || data.error}`);
        return [];
      }

      if (!data.data?.children) {
        return [];
      }

      return data.data.children.map(child => ({
        title: child.data.title,
        score: child.data.score,
        url: child.data.url,
        subreddit: child.data.subreddit,
        num_comments: child.data.num_comments,
        created_utc: child.data.created_utc,
      }));
    } catch (error) {
      console.warn(`[RedditClient] Gagal fetch /r/${subreddit}:`,
        error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  /**
   * Fetch top posts untuk semua subreddit dalam satu kategori
   */
  async getCategoryPosts(
    categorySlug: string,
    timeFilter: 'day' | 'week' | 'month' | 'year' | 'all' = 'day',
    limitPerSub: number = 10
  ): Promise<Array<{ subreddit: string; posts: RedditPost[] }>> {
    const subreddits = CATEGORY_SUBREDDITS[categorySlug];
    if (!subreddits || subreddits.length === 0) {
      console.warn(`[RedditClient] Tidak ada subreddit untuk kategori "${categorySlug}"`);
      return [];
    }

    const results: Array<{ subreddit: string; posts: RedditPost[] }> = [];

    for (const subreddit of subreddits) {
      console.log(`[RedditClient] Fetch /r/${subreddit} (${timeFilter}, limit=${limitPerSub})`);
      const posts = await this.getTopPosts(subreddit, timeFilter, limitPerSub);

      results.push({ subreddit, posts });

      // Hormati rate limit: jeda 2 detik antar subreddit
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    return results;
  }
}

/**
 * Singleton instance
 */
let redditClientInstance: RedditClient | null = null;

export function getRedditClient(): RedditClient {
  if (!redditClientInstance) {
    redditClientInstance = new RedditClient();
  }
  return redditClientInstance;
}