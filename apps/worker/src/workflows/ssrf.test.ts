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

  it('allows a public IP-literal host', async () => {
    await expect(assertPublicUrl('https://93.184.216.34/')).resolves.toBeUndefined();
  });
});
