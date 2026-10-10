/**
 * EDX_IMT handles real remittance data (account numbers, sender/beneficiary
 * identifiers). Fields in this list are masked before anything gets logged,
 * per Phase 7 hardening — RestclientService logs every outbound/inbound
 * payload for traceability, so redaction has to happen at that seam.
 */
const SENSITIVE_KEYS = new Set([
  'accountIdentifier',
  'accountNumber',
  'beneficiaryAccountIdentifier',
  'senderIdentifier',
  'accountName',
  'beneficiaryName',
  'senderName',
  'password',
  'secret',
  'token',
  'access_token',
]);

function maskValue(value: string): string {
  if (value.length <= 4) return '*'.repeat(value.length);
  return `${'*'.repeat(value.length - 4)}${value.slice(-4)}`;
}

export function redact(payload: unknown): unknown {
  if (payload === null || payload === undefined) return payload;

  if (Array.isArray(payload)) {
    return payload.map((item) => redact(item));
  }

  if (typeof payload === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(
      payload as Record<string, unknown>,
    )) {
      if (SENSITIVE_KEYS.has(key) && typeof value === 'string') {
        result[key] = maskValue(value);
      } else if (typeof value === 'object') {
        result[key] = redact(value);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  return payload;
}
