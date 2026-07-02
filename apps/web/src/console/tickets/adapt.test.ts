// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { toDisplayTicket, toDisplayUser, usersById, savedViews } from './adapt';
import type { TicketRow } from '../../api/types';
import type { UserRow } from '../../api/users';

const u: UserRow = { id: 'u1', email: 'sam@x.io', name: 'Sam Rivera', role: 'agent', status: 'active', createdAt: '' };
const row: TicketRow = { id: 't1', number: 142, status: 'open', priority: 'high', requesterId: 'r1', assigneeId: 'u1',
  teamId: null, dueAt: null, schemaId: 's1', schemaVersion: 1, data: { title: 'Printer offline', category: 'Hardware' },
  createdAt: '2026-06-01T00:00:00.000Z', updatedAt: '2026-06-02T00:00:00.000Z', formId: null,
  slaResponseDueAt: null, slaResolutionDueAt: null, firstRespondedAt: null,
  slaResponseBreachedAt: null, slaResolutionBreachedAt: null };

describe('adapt', () => {
  it('toDisplayUser derives stable initials + a color', () => {
    const d = toDisplayUser(u);
    expect(d.initials).toBe('SR');
    expect(d.color).toMatch(/^#|hsl|var/);
    expect(toDisplayUser(u).color).toBe(d.color); // deterministic
  });
  it('toDisplayTicket maps ISO dates to epoch ms and resolves title/type', () => {
    const d = toDisplayTicket(row, { s1: 'request' });
    expect(d.title).toBe('Printer offline');
    expect(d.type).toBe('request');
    expect(d.updatedAt).toBe(Date.parse('2026-06-02T00:00:00.000Z'));
    expect(typeof d.createdAt).toBe('number');
    expect(d.data.category).toBe('Hardware');
  });
  it('usersById indexes display users', () => {
    expect(usersById([u]).u1.name).toBe('Sam Rivera');
  });
  it('savedViews(me) filters: My open uses the real user id', () => {
    const views = savedViews('u1');
    const myOpen = views.find((v) => v.id === 'my_open')!;
    expect(myOpen.filter(toDisplayTicket(row, { s1: 'request' }))).toBe(true);
    const unassigned = views.find((v) => v.id === 'unassigned')!;
    expect(unassigned.filter(toDisplayTicket(row, {}))).toBe(false);
  });
});
