// SPDX-License-Identifier: AGPL-3.0-only

import dns from 'node:dns/promises';
import net from 'node:net';

/**
 * SSRF guard for the `http_request` workflow node. Blocks requests to
 * loopback / private / link-local / ULA / carrier-NAT / multicast addresses and
 * the cloud-metadata endpoint, and rejects non-HTTP(S) schemes. Hostnames are
 * resolved and every returned address is checked.
 *
 * (Residual: a hostname that passes this check could in theory be re-pointed to a
 * private IP between resolution and connection — classic DNS rebinding. The node
 * is admin-authored and this blocks the realistic targets, including a hostname
 * that currently resolves to an internal address.)
 */

/** Classify a dotted-quad IPv4 as private / loopback / link-local / reserved. */
function isBlockedIPv4(a: number, b: number): boolean {
  if (a === 0 || a === 10 || a === 127) return true; // "this host", private-A, loopback
  if (a === 169 && b === 254) return true; // link-local (incl. 169.254.169.254 metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // private-B
  if (a === 192 && b === 168) return true; // private-C
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
  if (a === 192 && b === 0) return true; // IETF protocol assignments (incl. 192.0.0.0/24)
  if (a >= 224) return true; // multicast + reserved
  return false;
}

/**
 * Expand a (net.isIPv6-valid) address to its 8 16-bit hextets, resolving `::`
 * and any trailing dotted-IPv4 tail. Returns null if it can't be parsed.
 */
function expandIPv6(addr: string): number[] | null {
  let s = addr.toLowerCase();
  const zone = s.indexOf('%'); // strip a scope/zone id (fe80::1%eth0)
  if (zone >= 0) s = s.slice(0, zone);

  // A trailing dotted-IPv4 tail (e.g. ::ffff:169.254.169.254) → two hextets.
  const dotted = s.match(/^(.*:)(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (dotted) {
    const q = [dotted[2], dotted[3], dotted[4], dotted[5]].map(Number);
    if (q.some((n) => n > 255)) return null;
    const h = (hi: number, lo: number) => ((hi << 8) | lo).toString(16);
    s = dotted[1] + h(q[0], q[1]) + ':' + h(q[2], q[3]);
  }

  const halves = s.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 ? (halves[1] ? halves[1].split(':') : []) : null;

  let groups: string[];
  if (tail === null) {
    groups = head;
  } else {
    const missing = 8 - head.length - tail.length;
    if (missing < 0) return null;
    groups = [...head, ...Array(missing).fill('0'), ...tail];
  }
  if (groups.length !== 8) return null;

  const out = groups.map((g) => parseInt(g || '0', 16));
  if (out.some((n) => Number.isNaN(n) || n < 0 || n > 0xffff)) return null;
  return out;
}

export function isBlockedAddress(ip: string): boolean {
  // Fast path for a textual IPv4-mapped literal (::ffff:1.2.3.4) — but note the
  // real defence is expandIPv6 below, since new URL() normalises such literals to
  // the hex form (::ffff:102:304) before the guard ever sees them.
  const mapped = ip.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i);
  const addr = mapped ? mapped[1] : ip;

  if (net.isIPv4(addr)) {
    const [a, b] = addr.split('.').map(Number);
    return isBlockedIPv4(a, b);
  }
  if (net.isIPv6(addr)) {
    const g = expandIPv6(addr);
    if (!g) return true; // unparseable IPv6 → block

    // IPv4-mapped (::ffff:0:0/96), IPv4-compatible (::/96, deprecated), and
    // NAT64 (64:ff9b::/96) all carry a real IPv4 destination in the low 32 bits.
    // Reclassify those against the IPv4 rules so a hex-encoded ::ffff:a9fe:a9fe
    // (169.254.169.254) can't slip past as "just an IPv6 address".
    const highZero = g[0] === 0 && g[1] === 0 && g[2] === 0 && g[3] === 0;
    const isMapped = highZero && g[4] === 0 && (g[5] === 0xffff || g[5] === 0);
    const isNat64 = g[0] === 0x64 && g[1] === 0xff9b && g[2] === 0 && g[3] === 0 && g[4] === 0 && g[5] === 0;
    if (isMapped || isNat64) {
      return isBlockedIPv4(g[6] >> 8, g[6] & 0xff);
    }

    if (g.every((h) => h === 0)) return true; // :: unspecified
    if (g[0] === 0 && g[1] === 0 && g[2] === 0 && g[3] === 0 && g[4] === 0 && g[5] === 0 && g[6] === 0 && g[7] === 1) return true; // ::1 loopback
    if ((g[0] & 0xffc0) === 0xfe80) return true; // link-local fe80::/10
    if ((g[0] & 0xfe00) === 0xfc00) return true; // unique-local fc00::/7
    return false;
  }
  return true; // unrecognized → block
}

/** Throws if `rawUrl` is not a public HTTP(S) URL safe to fetch from a workflow. */
export async function assertPublicUrl(rawUrl: string): Promise<void> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('Invalid request URL.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Unsupported URL scheme "${url.protocol}" (only http/https are allowed).`);
  }
  // URL.hostname wraps IPv6 literals in brackets (`[::1]`); strip them so net.isIP recognizes the address.
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = net.isIP(host)
    ? [{ address: host }]
    : await dns.lookup(host, { all: true }).catch(() => {
        throw new Error(`Could not resolve host "${host}".`);
      });
  for (const { address } of addresses) {
    if (isBlockedAddress(address)) {
      throw new Error('Request to a private or internal address is not allowed.');
    }
  }
}
