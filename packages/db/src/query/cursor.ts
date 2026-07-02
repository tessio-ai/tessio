// SPDX-License-Identifier: AGPL-3.0-only

/** The decoded position of a keyset cursor: the last row's sort value + id. */
export interface CursorPosition {
  value: unknown;
  id: string;
}

/** Encode a position to a url-safe, opaque base64url token. */
export function encodeCursor(pos: CursorPosition): string {
  return Buffer.from(JSON.stringify(pos), 'utf8').toString('base64url');
}

/** Decode a cursor token; throws if malformed. */
export function decodeCursor(token: string): CursorPosition {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
  } catch {
    throw new Error('Invalid cursor');
  }
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('id' in parsed) ||
    typeof (parsed as Record<string, unknown>).id !== 'string'
  ) {
    throw new Error('Invalid cursor');
  }
  const obj = parsed as Record<string, unknown>;
  return { value: obj.value ?? null, id: obj.id as string };
}
