/**
 * Parse Google Cloud service account key JSON from messy pastes (markdown fences,
 * junk before/after, multiple JSON values, smart quotes / fullwidth braces).
 */

function sanitizeCommonJsonPasteMistakes(s: string): string {
  return s
    .replace(/\u201c|\u201d/g, '"')
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\uff5b/g, "{")
    .replace(/\uff5d/g, "}");
}

/** First `{` from `fromIndex` … matching `}` outside JSON strings. */
function extractFirstTopLevelJsonObject(input: string, fromIndex = 0): string | null {
  const start = input.indexOf("{", fromIndex);
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < input.length; i++) {
    const c = input[i];
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (c === "\\") {
        escape = true;
        continue;
      }
      if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return input.slice(start, i + 1);
    }
  }
  return null;
}

/** BOM, smart quotes / fullwidth braces, optional ``` fences. */
function preprocessServiceAccountPaste(raw: string): string {
  let s = raw.trim();
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1).trim();
  s = sanitizeCommonJsonPasteMistakes(s);
  if (s.startsWith("```")) {
    const nl = s.indexOf("\n");
    if (nl !== -1) s = s.slice(nl + 1);
    const endFence = s.lastIndexOf("```");
    if (endFence !== -1) s = s.slice(0, endFence);
    s = s.trim();
    if (s.charCodeAt(0) === 0xfeff) s = s.slice(1).trim();
    s = sanitizeCommonJsonPasteMistakes(s);
  }
  return s;
}

/** Unique candidate JSON object strings (full preprocessed paste + every `{…}` block). */
function collectServiceAccountJsonCandidates(raw: string): string[] {
  const s = preprocessServiceAccountPaste(raw);
  const seen = new Set<string>();
  const out: string[] = [];
  function add(t: string) {
    const u = t.trim();
    if (!u || seen.has(u)) return;
    seen.add(u);
    out.push(u);
  }
  add(s);
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== "{") continue;
    const blob = extractFirstTopLevelJsonObject(s, i);
    if (blob) add(blob);
  }
  return out;
}

export function tryParseServiceAccountCredentials(raw: string):
  | { ok: true; creds: Record<string, unknown> }
  | { ok: false; error: string } {
  const candidates = collectServiceAccountJsonCandidates(raw);
  let lastSyntax: string | null = null;
  let foundPlainObject = false;

  for (const cand of candidates) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(cand);
    } catch (e) {
      lastSyntax = e instanceof SyntaxError ? e.message : "parse error";
      continue;
    }

    if (typeof parsed === "string") {
      const inner = parsed.trim();
      if (inner.includes("private_key") && inner.includes("BEGIN PRIVATE KEY")) {
        const nested = tryParseServiceAccountCredentials(inner);
        if (nested.ok) return nested;
      }
      continue;
    }

    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      continue;
    }

    foundPlainObject = true;
    const creds = parsed as Record<string, unknown>;
    if (creds.type !== "service_account") continue;

    if (typeof creds.private_key !== "string" || !creds.private_key.includes("BEGIN PRIVATE KEY")) {
      return {
        ok: false,
        error:
          'Missing or broken "private_key". If you edited the JSON, keep the PEM newlines as \\n inside the string.',
      };
    }
    if (typeof creds.client_email !== "string" || !creds.client_email.includes("@")) {
      return { ok: false, error: 'Missing "client_email". Use the .json key file from Google Cloud unchanged.' };
    }
    return { ok: true, creds };
  }

  if (foundPlainObject) {
    return {
      ok: false,
      error:
        'This file is not a service account key (expected "type": "service_account"). Download JSON from IAM → Service accounts → Keys.',
    };
  }

  if (!lastSyntax) {
    return {
      ok: false,
      error: "Service account key must be a single JSON object {...}, not an array or plain text.",
    };
  }

  const hint = lastSyntax;
  let msg = `Invalid JSON (${hint}). Paste the full service account key file from Google Cloud (one {...} object). Remove any text before "{" or after "}", and do not use smart quotes.`;
  if (hint.includes("after JSON")) {
    msg +=
      " If you see “after JSON at position …”, you likely pasted two values in one field (e.g. [null] or a short string before the real {…} key), or two JSON objects — keep only one service account JSON object.";
  }
  return { ok: false, error: msg };
}

/**
 * Prefer a valid key from Admin (DB) when it parses; otherwise fall back to `GOOGLE_SERVICE_ACCOUNT_JSON`.
 * Avoids a broken DB paste shadowing a working .env key.
 */
export function tryParseServiceAccountFromDbOrEnv(
  dbJson: string | null | undefined,
  envJson: string | undefined,
): ReturnType<typeof tryParseServiceAccountCredentials> {
  const d = dbJson?.trim() ?? "";
  const e = envJson?.trim() ?? "";
  if (d) {
    const pd = tryParseServiceAccountCredentials(d);
    if (pd.ok) return pd;
  }
  if (e) {
    const pe = tryParseServiceAccountCredentials(e);
    if (pe.ok) return pe;
  }
  if (d) return tryParseServiceAccountCredentials(d);
  if (e) return tryParseServiceAccountCredentials(e);
  return {
    ok: false,
    error:
      'Missing service account JSON. Paste the key in Admin → Booking, or set GOOGLE_SERVICE_ACCOUNT_JSON in .env (one {"type":"service_account",...} object).',
  };
}

/** Admin preview: client_email if paste is a valid service account key, else null. */
export function tryGetServiceAccountClientEmail(raw: string | null | undefined): string | null {
  const s = raw?.trim();
  if (!s) return null;
  const r = tryParseServiceAccountCredentials(s);
  if (!r.ok) return null;
  const e = r.creds.client_email;
  return typeof e === "string" && e.includes("@") ? e : null;
}

/** First `{…}` slice after preprocess, else full preprocess result (for debugging). */
export function normalizeServiceAccountJsonPaste(raw: string): string {
  const s = preprocessServiceAccountPaste(raw);
  return extractFirstTopLevelJsonObject(s, 0) ?? s;
}
