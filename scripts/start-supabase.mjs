import {
  runSupabaseOrExit,
  waitForLocalSupabase,
} from './lib/supabase-cli.mjs';

runSupabaseOrExit(['start', '--yes']);
await waitForLocalSupabase();
