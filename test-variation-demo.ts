import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function loadEnv() {
  const envPath = join(process.cwd(), '.env');
  try {
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const [key, ...rest] = trimmed.split('=');
      if (key && rest.length) {
        const value = rest.join('=').trim();
        if (!process.env[key.trim()]) {
          process.env[key.trim()] = value;
        }
      }
    }
  } catch {
    // no .env file, continue without it
  }
}

loadEnv();

async function main() {
  const { generateScript } = await import('./src/lib/script-generator.js');
  const { validationFailureCounters } = await import('./src/lib/script-validator.js');

  const topic = 'mengapa manusia suka procrastinate';
  const tests = [
    { category: 'psychology' as const, run: 1 },
    { category: 'psychology' as const, run: 2 },
    { category: 'psychology' as const, run: 3 },
  ];

  const results: any[] = [];
  for (const t of tests) {
    const start = Date.now();
    try {
      const res = await generateScript(t.category, topic, 'short');
      const firstHook = res.scenes.find((s) => s.is_hook);
      const flaggedCount = res.scenes.filter((s) => s.flagged).length;
      results.push({
        run: t.run,
        totalScenes: res.scenes.length,
        flaggedCount,
        hookNarration: firstHook?.narration || '-',
        hookMood: firstHook?.scene_mood || '-',
      });
    } catch (e) {
      results.push({ run: t.run, error: (e as Error).message });
    }
    console.log(`Finished run ${t.run} in ${Date.now() - start}ms`);
  }

  console.log('\n=== VARIATION DEMO RESULTS (Psychology) ===');
  console.table(results);
  console.log('\nValidation Failure Counters:', JSON.stringify(validationFailureCounters));
}

main();