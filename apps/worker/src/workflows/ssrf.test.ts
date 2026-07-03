// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { isBlockedAddress, assertPublicUrl } from './ssrf';

describe('isBlockedAddress', () => {
  it('blocks loopback / private / link-local / CGNAT IPv4', () => {
    for (const ip of ['127.0.0.1', '10.0.0.1', '172.16.5.5', '172.31.255.255', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1']) {
      expect(isBlockedAddress(ip), ip).toBe(true);
    }
  });

  it('allows ordinary public IPv4', () => {
    for (const ip of ['8.8.8.8', '93.184.216.34', '1.1.1.1', '172.15.0.1', '172.32.0.1', '100.63.0.1', '100.128.0.1']) {
      expect(isBlockedAddress(ip), ip).toBe(false);
    }
  });

  it('blocks loopback / link-local / ULA IPv6 and IPv4-mapped privates', () => {
    for (const ip of ['::1', '::', 'fe80::1', 'fc00::1', 'fd12:3456::1', '::ffff:127.0.0.1', '::ffff:10.0.0.1']) {
      expect(isBlockedAddress(ip), ip).toBe(true);
    }
  });

  it('allows public IPv6 and IPv4-mapped publics', () => {
    expect(isBlockedAddress('2606:4700:4700::1111')).toBe(false);
    expect(isBlockedAddress('::ffff:8.8.8.8')).toBe(false);
  });

  it('blocks hex-encoded IPv4-mapped privates (the form new URL() produces)', () => {
    // new URL('http://[::ffff:169.254.169.254]/') normalises the host to this hex form.
    for (const ip of ['::ffff:a9fe:a9fe', '::ffff:7f00:1', '::ffff:a00:5', '::ffff:c0a8:1']) {
      expect(isBlockedAddress(ip), ip).toBe(true);
    }
    // ...but a hex-encoded public mapped address is still allowed.
    expect(isBlockedAddress('::ffff:808:808')).toBe(false); // 8.8.8.8
  });

  it('blocks IPv4-compatible and NAT64 embeddings of private addresses', () => {
    expect(isBlockedAddress('::7f00:1')).toBe(true); // ::127.0.0.1 (IPv4-compatible)
    expect(isBlockedAddress('64:ff9b::a9fe:a9fe')).toBe(true); // NAT64 169.254.169.254
  });

  it('blocks anything unrecognized', () => {
    expect(isBlockedAddress('not-an-ip')).toBe(true);
  });
});

describe('assertPublicUrl', () => {
  it('rejects non-http(s) schemes', async () => {
    await expect(assertPublicUrl('file:///etc/passwd')).rejects.toThrow(/scheme/);
    await expect(assertPublicUrl('ftp://example.com')).rejects.toThrow(/scheme/);
    await expect(assertPublicUrl('gopher://x')).rejects.toThrow(/scheme/);
  });

  it('rejects malformed URLs', async () => {
    await expect(assertPublicUrl('not a url')).rejects.toThrow(/Invalid/);
  });

  // IP-literal hosts skip DNS, so these are deterministic and offline.
  it('rejects loopback / private / metadata IP-literal hosts', async () => {
    await expect(assertPublicUrl('http://127.0.0.1/')).rejects.toThrow(/private or internal/);
    await expect(assertPublicUrl('http://169.254.169.254/latest/meta-data/')).rejects.toThrow(/private or internal/);
    await expect(assertPublicUrl('http://10.0.0.1:8080/')).rejects.toThrow(/private or internal/);
    await expect(assertPublicUrl('http://[::1]/')).rejects.toThrow(/private or internal/);
  });

  // Regression: IPv4-mapped IPv6 literals. new URL() normalises the host to the
  // hex form BEFORE the guard sees it, so these must be exercised through URL
  // parsing (not the bare string) to catch the bypass.
  it('rejects IPv4-mapped IPv6 literal hosts (metadata / loopback / RFC1918)', async () => {
    await expect(assertPublicUrl('http://[::ffff:169.254.169.254]/latest/meta-data/')).rejects.toThrow(/private or internal/);
    await expect(assertPublicUrl('http://[::ffff:127.0.0.1]:5432/')).rejects.toThrow(/private or internal/);
    await expect(assertPublicUrl('http://[::ffff:10.0.0.5]/')).rejects.toThrow(/private or internal/);
  });

  it('allows a public IP-literal host', async () => {
    await expect(assertPublicUrl('https://93.184.216.34/')).resolves.toBeUndefined();
  });
});
