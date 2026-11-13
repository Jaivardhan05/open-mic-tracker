// Razorpay / billing configuration checks.
//
// Everything here is a pure function of an env object, so it can be tested with fake
// objects. Nothing returns or logs a VALUE: results carry variable NAMES and plain-language
// problems only (the one thing quoted is the word "test" or "live" from RAZORPAY_MODE,
// which is not a secret).

export type Env = Record<string, string | undefined>;
export type RazorpayMode = 'test' | 'live';

export interface ConfigResult {
  ok: boolean;
  problems: string[];
}

const KEY_PREFIX: Record<RazorpayMode, string> = { test: 'rzp_test_', live: 'rzp_live_' };

/** Same rule as `apps/api/src/index.ts`: PORT, or 8080 when unset or not a number. */
export function getApiPort(env: Env): number {
  return Number(env.PORT) || 8080;
}

/** "Deployed" means NODE_ENV=production (spec: start-up check). */
export function isDeployed(env: Env): boolean {
  return env.NODE_ENV === 'production';
}

function isBlank(v: string | undefined): boolean {
  return v === undefined || v.trim() === '';
}

/** True when a value has leading/trailing whitespace or is wrapped in quotes (the usual .env typos). */
function hasFormattingTypo(v: string): boolean {
  return v !== v.trim() || /^["']|["']$/.test(v);
}

function modeOf(v: string | undefined): RazorpayMode | null {
  return v === 'test' || v === 'live' ? v : null;
}

function prefixModeOf(keyId: string | undefined): RazorpayMode | null {
  if (!keyId) return null;
  if (keyId.startsWith(KEY_PREFIX.test)) return 'test';
  if (keyId.startsWith(KEY_PREFIX.live)) return 'live';
  return null;
}

/**
 * The key id prefix versus RAZORPAY_MODE check. Runs EVERY time the Razorpay client is
 * built, deployed or not (spec: start-up check). Returns a problem text or null.
 */
export function modeMismatchProblem(env: Env): string | null {
  const keyMode = prefixModeOf(env.RAZORPAY_KEY_ID);
  const mode = modeOf(env.RAZORPAY_MODE);
  if (keyMode && mode && keyMode !== mode) {
    return `RAZORPAY_KEY_ID is a ${keyMode}-mode key but RAZORPAY_MODE is "${mode}"; they must agree.`;
  }
  return null;
}

/**
 * Full Razorpay configuration check. `requireCronSecret` is for Step 10 onwards
 * (BILLING_CRON_SECRET is not needed before then).
 */
export function checkRazorpayConfig(env: Env, opts: { requireCronSecret?: boolean } = {}): ConfigResult {
  const problems: string[] = [];

  if (isBlank(env.RAZORPAY_KEY_ID)) {
    problems.push('RAZORPAY_KEY_ID is missing.');
  } else if (prefixModeOf(env.RAZORPAY_KEY_ID) === null) {
    problems.push('RAZORPAY_KEY_ID must start with rzp_test_ or rzp_live_.');
  }

  if (isBlank(env.RAZORPAY_KEY_SECRET)) problems.push('RAZORPAY_KEY_SECRET is missing.');
  if (isBlank(env.RAZORPAY_WEBHOOK_SECRET)) problems.push('RAZORPAY_WEBHOOK_SECRET is missing.');

  if (isBlank(env.RAZORPAY_MODE)) {
    problems.push('RAZORPAY_MODE is missing (must be "test" or "live").');
  } else if (modeOf(env.RAZORPAY_MODE) === null) {
    problems.push('RAZORPAY_MODE must be exactly "test" or "live".');
  }

  for (const name of ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET', 'RAZORPAY_MODE'] as const) {
    const v = env[name];
    if (v !== undefined && !isBlank(v) && hasFormattingTypo(v)) {
      problems.push(`${name} has leading/trailing spaces or quotes; write NAME=value with nothing around the value.`);
    }
  }

  const mismatch = modeMismatchProblem(env);
  if (mismatch) problems.push(mismatch);

  if (opts.requireCronSecret && isBlank(env.BILLING_CRON_SECRET)) {
    problems.push('BILLING_CRON_SECRET is missing.');
  }

  return { ok: problems.length === 0, problems };
}

/** Short start-up note on where the Razorpay webhook has to reach this API. */
export function webhookPortNote(env: Env): string {
  const port = getApiPort(env);
  return (
    `Razorpay webhook: the tunnel must forward to this API's port ${port} ` +
    `(route /api/webhooks/razorpay, added in Step 4; until then a throwaway receiver is used).`
  );
}

export interface StartupReport {
  /** Lines to print at start-up (names and plain text only, never values). */
  lines: string[];
  /** Non-empty means the API must exit: billing is on (or unknown) in a deployed run and the config is incomplete. */
  fatal: string[];
}

/**
 * Builds the start-up report.
 * `billingEnabled`: true / false from `billing_settings.billing_enabled` (a missing table is false),
 * or 'unknown' when the flag could not be read. In a deployed run an unknown flag is checked
 * strictly, so a database hiccup can never silently skip the check.
 */
export function buildStartupReport(env: Env, billingEnabled: boolean | 'unknown'): StartupReport {
  const lines: string[] = [webhookPortNote(env)];
  const fatal: string[] = [];
  const result = checkRazorpayConfig(env);

  if (result.ok) {
    lines.push(`Razorpay config: complete (mode ${modeOf(env.RAZORPAY_MODE)}).`);
  } else {
    lines.push(
      'Razorpay config incomplete: ' + result.problems.join(' ') +
        (billingEnabled === false ? ' (billing is off, so start-up is not blocked)' : ''),
    );
  }

  if (!result.ok && isDeployed(env) && billingEnabled !== false) {
    fatal.push(...result.problems);
  }

  return { lines, fatal };
}
