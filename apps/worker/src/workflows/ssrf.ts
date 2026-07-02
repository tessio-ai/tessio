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
export function isBlockedAddress(ip: string): boolean {
  const mapped = ip.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i);
  const addr = mapped ? mapped[1] : ip;

  if (net.isIPv4(addr)) {
    const [a, b] = addr.split('.').map(Number);
    if (a === 0 || a === 10 || a === 127) return true; // "this host", private-A, loopback
    if (a === 169 && b === 254) return true; // link-local (incl. 169.254.169.254 metadata)
    if (a === 172 && b >= 16 && b <= 31) return true; // private-B
    if (a === 192 && b === 168) return true; // private-C
    if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
    if (a === 192 && b === 0) return true; // IETF protocol assignments (incl. 192.0.0.0/24)
    if (a >= 224) return true; // multicast + reserved
    return false;
  }
  if (net.isIPv6(addr)) {
    const low = addr.toLowerCase();
    if (low === '::1' || low === '::') return true; // loopback / unspecified
    if (low.startsWith('fe8') || low.startsWith('fe9') || low.startsWith('fea') || low.startsWith('feb')) return true; // link-local fe80::/10
    if (low.startsWith('fc') || low.startsWith('fd')) return true; // unique-local fc00::/7
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
