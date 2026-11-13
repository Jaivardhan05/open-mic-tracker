// Billing start-up check (spec, "Start-up check"): runs once, before the server listens.
//
// - "Billing is on" = billing_settings.billing_enabled = true, read once here. A MISSING table
//   (migration 030 not applied yet) means off. Any other read failure means "unknown", which a
//   deployed run treats strictly, so a database hiccup never silently skips the check.
// - "Deployed" = NODE_ENV=production. Only then, with billing on or unknown and the config
//   incomplete, does the API exit. Local development and unrelated work are never blocked.
// - Messages name variables, never values. Nothing secret is logged.

import { supabaseAdmin } from '../lib/supabase.js';
import { buildStartupReport, type Env } from './config.js';

// PostgREST "table not in schema cache" and Postgres "undefined_table".
const MISSING_TABLE_CODES = new Set(['PGRST205', '42P01']);

async function readBillingEnabled(): Promise<boolean | 'unknown'> {
  try {
    const { data, error } = await supabaseAdmin
      .from('billing_settings')
      .select('billing_enabled')
      .abortSignal(AbortSignal.timeout(5000))
      .maybeSingle();

    if (error) return MISSING_TABLE_CODES.has(error.code) ? false : 'unknown';
    return data?.billing_enabled === true;
  } catch {
    return 'unknown';
  }
}

export async function runBillingStartupCheck(env: Env = process.env): Promise<void> {
  const billingEnabled = await readBillingEnabled();
  const report = buildStartupReport(env, billingEnabled);

  for (const line of report.lines) console.log('[billing] ' + line);

  if (report.fatal.length > 0) {
    console.error(
      '[billing] Refusing to start: billing is ' +
        (billingEnabled === 'unknown' ? 'in an unknown state' : 'on') +
        ' in a production run and the Razorpay configuration is incomplete:',
    );
    for (const problem of report.fatal) console.error('[billing]  - ' + problem);
    process.exit(1);
  }
}
