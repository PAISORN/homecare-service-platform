import {
  runSupabaseOrExit,
  waitForLocalSupabase,
} from './lib/supabase-cli.mjs';

runSupabaseOrExit(['db', 'reset', '--local']);
await waitForLocalSupabase();
