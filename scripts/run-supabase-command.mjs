import { runSupabaseOrExit } from './lib/supabase-cli.mjs';

if (process.argv.length < 3) {
  process.stderr.write(
    'Usage: node scripts/run-supabase-command.mjs <args...>\n',
  );
  process.exit(2);
}

runSupabaseOrExit(process.argv.slice(2));
