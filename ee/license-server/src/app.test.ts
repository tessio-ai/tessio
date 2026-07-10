// SPDX-License-Identifier: LicenseRef-Tessio-Commercial

import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { generateKeypair, publicKeyFromRaw, verifyLicenseKey } from '@tessio/license';
import { buildLicenseServer } from './app';
import { InMemorySubscriptionStore, type Subscription } from './store';
import { verifyStripeSignature, subscriptionFromEvent } from './stripe';

const NOW = 1_700_000_000;
const keys = generateKeypair();
const pub = publicKeyFromRaw(keys.publicKey);

const activeSub: Subscription = { active: true, edition: 'enterprise', subject: 'Acme', licenseId: 'lic_1' };

function server(seed?: Record<string, Subscription>, webhookSecret?: string) {
  const store = new InMemorySubscriptionStore(seed);
  const app = buildLicenseServer({ store, privateKey: keys.privateKey, stripeWebhookSecret: webhookSecret, now: () => NOW });
  return { app, store };
}

describe('POST /license/check-in', () => {
  it('issues a valid short-TTL entitlement for an active subscription', async () => {
    const { app } = server({ tok_active: activeSub });
    const res = await app.inject({ method: 'POST', url: '/license/check-in', payload: { token: 'tok_active' } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.edition).toBe('enterprise');
    expect(body.expiresAt).toBe(NOW + 14 * 86400);
    // the returned token really verifies against the vendor public key
    const v = verifyLicenseKey(body.token, { now: NOW, publicKey: pub });
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.claims.subject).toBe('Acme');
  });

  it('403s for an unknown token', async () => {
    const { app } = server();
    const res = await app.inject({ method: 'POST', url: '/license/check-in', payload: { token: 'nope' } });
    expect(res.statusCode).toBe(403);
  });

  it('403s for a lapsed (inactive) subscription', async () => {
    const { app } = server({ tok_lapsed: { ...activeSub, active: false } });
    const res = await app.inject({ method: 'POST', url: '/license/check-in', payload: { token: 'tok_lapsed' } });
    expect(res.statusCode).toBe(403);
  });

  it('400s when the token is missing', async () => {
    const { app } = server();
    const res = await app.inject({ method: 'POST', url: '/license/check-in', payload: {} });
    expect(res.statusCode).toBe(400);
  });
});

describe('POST /stripe/webhook', () => {
  const secret = 'whsec_test';

  function signed(payloadObj: unknown) {
    const raw = JSON.stringify(payloadObj);
    const sig = createHmac('sha256', secret).update(`${NOW}.${raw}`).digest('hex');
    return { raw, header: `t=${NOW},v1=${sig}` };
  }

  it('activates a subscription from a valid event, unlocking check-in', async () => {
    const { app } = server({}, secret);
    const event = {
      type: 'customer.subscription.created',
      data: { object: { status: 'active', metadata: { tessio_license_token: 'tok_new', tessio_edition: 'enterprise', tessio_subject: 'Beta Inc' } } },
    };
    const { raw, header } = signed(event);
    const hook = await app.inject({ method: 'POST', url: '/stripe/webhook', payload: raw, headers: { 'content-type': 'application/json', 'stripe-signature': header } });
    expect(hook.statusCode).toBe(200);

    const checkin = await app.inject({ method: 'POST', url: '/license/check-in', payload: { token: 'tok_new' } });
    expect(checkin.statusCode).toBe(200);
    expect(checkin.json().edition).toBe('enterprise');
  });

  it('revokes on a deleted event, so check-in then fails closed', async () => {
    const { app } = server({ tok_x: activeSub }, secret);
    const event = {
      type: 'customer.subscription.deleted',
      data: { object: { status: 'canceled', metadata: { tessio_license_token: 'tok_x', tessio_edition: 'enterprise' } } },
    };
    const { raw, header } = signed(event);
    await app.inject({ method: 'POST', url: '/stripe/webhook', payload: raw, headers: { 'content-type': 'application/json', 'stripe-signature': header } });
    const checkin = await app.inject({ method: 'POST', url: '/license/check-in', payload: { token: 'tok_x' } });
    expect(checkin.statusCode).toBe(403);
  });

  it('rejects a forged signature', async () => {
    const { app } = server({}, secret);
    const res = await app.inject({
      method: 'POST',
      url: '/stripe/webhook',
      payload: JSON.stringify({ type: 'customer.subscription.created' }),
      headers: { 'content-type': 'application/json', 'stripe-signature': `t=${NOW},v1=deadbeef` },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('stripe helpers (unit)', () => {
  it('verifyStripeSignature accepts a genuine signature and rejects a stale one', () => {
    const raw = '{"hello":"world"}';
    const sig = createHmac('sha256', 'sec').update(`${NOW}.${raw}`).digest('hex');
    expect(verifyStripeSignature(raw, `t=${NOW},v1=${sig}`, 'sec', NOW)).toBe(true);
    // outside the tolerance window
    expect(verifyStripeSignature(raw, `t=${NOW},v1=${sig}`, 'sec', NOW + 10_000)).toBe(false);
    expect(verifyStripeSignature(raw, undefined, 'sec', NOW)).toBe(false);
  });

  it('subscriptionFromEvent ignores events without our metadata', () => {
    expect(subscriptionFromEvent({ type: 'customer.subscription.updated', data: { object: { status: 'active', metadata: {} } } })).toBeNull();
    expect(subscriptionFromEvent({ type: 'invoice.paid' })).toBeNull();
  });
});
