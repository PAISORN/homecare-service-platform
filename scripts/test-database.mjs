import {
  runSupabaseOrExit,
  waitForLocalSupabase,
} from './lib/supabase-cli.mjs';

await waitForLocalSupabase();
runSupabaseOrExit(['test', 'db', '--local']);
