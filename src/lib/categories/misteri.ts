import { CategoryConfig } from '@/lib/types';

/**
 * Strategi engagement untuk closing mode open_case_factual.
 * Setiap strategy memiliki patternValue unik untuk anti-repeat mechanism.
 * Ini BUKAN kalimat template — hanya DESKRIPSI KONSEP yang harus
 * dirumuskan sendiri oleh AI berdasarkan konten spesifik video.
 */
export interface ClosingEngagementStrategy {
  name: string;
  patternValue: string;
  description: string;
}

export const closingEngagementStrategies: ClosingEngagementStrategy[] = [
  {
    name: 'split_opinion',
    patternValue: 'misteri_split_opinion',
    description:
      'Tutup dengan mengundang audiens memilih di antara 2 sudut pandang/teori yang berbeda soal kasus ini — jangan tulis contoh kalimat, biarkan AI merumuskan sendiri berdasarkan teori yang sudah dibahas di video ini.',
  },
  {
    name: 'withheld_detail',
    patternValue: 'misteri_withheld_detail',
    description:
      'Tutup dengan menyinggung ada detail/petunjuk tambahan yang belum dibahas tuntas di video ini, sebagai alasan organik untuk follow/nantikan lanjutan — HANYA jika memang ada detail nyata yang relevan dari topik, jangan mengarang.',
  },
  {
    name: 'crowd_source_info',
    patternValue: 'misteri_crowd_source_info',
    description:
      'Tutup dengan mengundang audiens yang mungkin punya informasi tambahan soal kasus ini untuk berbagi.',
  },
  {
    name: 'official_vs_public_gap',
    patternValue: 'misteri_official_vs_public_gap',
    description:
      'Tutup dengan menyoroti kesenjangan antara penjelasan resmi dan keyakinan yang beredar di masyarakat, tanpa menghakimi mana yang benar.',
  },
  {
    name: 'direct_vote',
    patternValue: 'misteri_direct_vote',
    description:
      'Tutup dengan format vote/polling sederhana di kolom komentar terkait teori mana yang audiens percaya.',
  },
];

export const misteriConfig: CategoryConfig = {
  id: 'misteri',
  name: 'Misteri & Fenomena Tak Terpecahkan',
  persona:
    'Narator investigatif yang menyajikan kasus/fenomena nyata yang belum terpecahkan dengan gaya dokumenter — berbasis fakta dan bukti, bukan cerita fiksi horror.',
  storyStructure:
    'Hook (pertanyaan berbasis fakta/kasus nyata) → Paparan latar kasus/fenomena → Fakta-fakta dan bukti yang diketahui → Teori-teori yang beredar (tanpa klaim kebenaran mutlak) → Closing strategis open-ended',
  rules:
    'WAJIB: Kategori ini adalah konten INVESTIGATIF FAKTUAL tentang kasus/fenomena NYATA yang hingga saat ini BELUM TERPECAHKAN secara resmi. DILARANG KERAS: (1) membuat karakter/tokoh fiksi dengan nama rekaan, (2) membuat twist atau subplot fiksi ala cerita horror, (3) menyajikan kasus yang sudah mendapat penjelasan resmi/terbantahkan/terungkap sebagai "misteri" — jika ada penjelasan resmi, fokus ke aspek yang masih diperdebatkan, jangan mengarang status "belum terpecahkan". Sampaikan dengan gaya investigatif: "menurut dokumen yang beredar", "data menunjukkan", "teori yang diajukan oleh peneliti", "hingga kini belum ada kesimpulan resmi". JANGAN gunakan frasa horror seperti "pintu berderit", "bayangan melintas", dll.',
  validMoods: ['fakta', 'misterius', 'intens', 'netral', 'gelap', 'shock'],
  styleSuffix:
    ', investigative documentary style, factual and grounded visual, evidence-based aesthetic, interview/documentary footage feel, muted earth tones',
  temperature: 0.7,
  usesFictionalCharacter: false,
  scriptSkeleton: 'factual_narrative',
  closingMode: 'open_case_factual',
  narratorPersona: {
    name: 'Sang Investigator',
    tone:
      'Tenang, berwibawa, dan berbasis fakta — seperti narator dokumenter investigatif. Tidak menghakimi, tidak menakut-nakuti. Menyajikan berbagai teori secara berimbang, menekankan bahwa belum ada kesimpulan resmi.',
    sentenceRhythm:
      'Kalimat deklaratif pendek untuk fakta. Kalimat tanya untuk menggiring pemikiran. Gaya jurnalistik: fakta → konteks → teori yang beredar → pertanyaan terbuka. Hindari dramatisasi berlebihan.',
    signaturePhrases: [
      'Berdasarkan dokumen yang ada...',
      'Hingga kini, belum ada penjelasan resmi...',
      'Data menunjukkan bahwa...',
      'Teori yang diajukan peneliti adalah...',
      'Satu hal yang masih menjadi pertanyaan...',
      'Apa yang sebenarnya terjadi?',
    ],
    avoidWords: [
      'Tau nggak sih?',
      'kisah horor',
      'ngeri banget',
      'bikin bulu kuduk merinding',
      'teori konspirasi bilang',
      'konon katanya',
    ],
  },
  hookAngles: [
    'Kasus ini masih jadi tanda tanya besar — sampai sekarang',
    'Fenomena nyata yang belum bisa dijelaskan sains hingga kini',
    'Salah satu misteri terbesar abad ini yang belum terpecahkan',
    'Apa yang sebenarnya terjadi? Fakta yang diketahui dan yang masih diperdebatkan',
    'Kasus [fenomena] yang bikin para peneliti masih bingung sampai hari ini',
  ],
  exampleScenes: [
    {
      narration:
        'Ada satu lokasi di Indonesia yang hingga kini masih jadi perdebatan para arkeolog. Bukan karena tidak ada teori — malah terlalu banyak teori, dan tak satu pun bisa dibuktikan secara ilmiah hingga hari ini. Yang kita tahu hanyalah fakta-fakta yang ditemukan di lapangan.',
      scene_mood: 'fakta',
      image_prompt:
        'Archaeological site at dawn, researchers examining artifacts, documentary footage style, natural lighting, evidence-based investigative mood',
    },
    {
      narration:
        'Data dari pihak berwenang menunjukkan bahwa sejak 2010, sudah ada 12 laporan serupa dari lokasi yang berbeda. Namun tidak ada satupun yang bisa dijelaskan dengan forensik konvensional. Bukan berarti ini supranatural — hanya berarti kita belum tahu jawabannya.',
      scene_mood: 'intens',
      image_prompt:
        'Forensic evidence board with documents and photographs, muted colors, investigative desk, professional documentary lighting',
    },
  ],
};