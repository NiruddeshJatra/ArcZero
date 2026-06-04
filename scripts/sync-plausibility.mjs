/**
 * Reads src/net/plausibility-constants.json and writes the constants block
 * into supabase/functions/submit_score/index.ts.
 *
 * Run after changing plausibility-constants.json:
 *   npm run sync-plausibility
 *
 * Then redeploy the Edge Function:
 *   supabase functions deploy submit_score --project-ref ntcwsxuzstbplroxswsr
 */
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const c = JSON.parse(readFileSync(join(root, 'src/net/plausibility-constants.json'), 'utf8'));

const block =
  `const ABSOLUTE_CEILING    = ${c.ABSOLUTE_CEILING};  // ${c.ABSOLUTE_CEILING.toLocaleString()}\n` +
  `const MIN_DURATION_MS     = ${c.MIN_DURATION_MS};      // ${c.MIN_DURATION_MS / 1000} seconds\n` +
  `const MAX_SCORE_PER_SEC   = ${c.MAX_SCORE_PER_SEC};\n` +
  `const MAX_RUN_DURATION_MS = ${c.MAX_RUN_DURATION_MS};  // 30 minutes`;

const serverPath = join(root, 'supabase/functions/submit_score/index.ts');
let src = readFileSync(serverPath, 'utf8');

src = src.replace(
  /const ABSOLUTE_CEILING\s+=.+\nconst MIN_DURATION_MS\s+=.+\nconst MAX_SCORE_PER_SEC\s+=.+\nconst MAX_RUN_DURATION_MS\s+=.+/,
  block,
);

writeFileSync(serverPath, src);
console.log('Synced plausibility constants → supabase/functions/submit_score/index.ts');
