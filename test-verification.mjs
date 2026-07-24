import { generateScript } from './src/lib/script-generator.js';
import { validationFailureCounters } from './src/lib/script-validator.js';

const tests = [
  { category: 'horror', topic: 'urban legend sekolah lama', duration: 'short' },
  { category: 'psychology', topic: 'mengapa manusia suka procrastinate', duration: 'short' },
  { category: 'romance', topic: 'jumpa lagi di kedai kopi', duration: 'short' },
  { category: 'motivation', topic: 'bangun pagi produktif', duration: 'short' },
  { category: 'education', topic: 'cara otak belajar hal baru', duration: 'short' },
  { category: 'affiliate', topic: 'review HP murah', duration: 'short', affiliateInput: { productDescription: 'HP Android 6 inch, RAM 8GB, baterai 5000mAh', productPrice: '2400000', productRating: 4.2 } },
];

const results = [];
for (const t of tests) {
  const start = Date.now();
  try {
    const res = await generateScript(t.category, t.topic, t.duration, t.affiliateInput);
    const flaggedCount = res.scenes.filter(s => s.flagged).length;
    results.push({
      category: t.category,
      totalScenes: res.scenes.length,
      flaggedCount,
      flaggedPct: ((flaggedCount / res.scenes.length) * 100).toFixed(1),
      failedSegment: res.failedSegment ?? null,
      sampleFlagged: res.scenes.filter(s => s.flagged).map(s => s.narration).slice(0, 1),
    });
  } catch (e) {
    results.push({ category: t.category, error: e.message });
  }
  console.log(`Finished ${t.category} in ${Date.now() - start}ms`);
}

console.log('\n=== RESULTS ===');
console.table(results);
console.log('\nValidation Failure Counters:', validationFailureCounters);