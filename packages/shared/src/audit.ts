// SPDX-License-Identifier: AGPL-3.0-only

export const AUDIT_ACTIONS = [
  'user.login', 'user.login_failed', 'user.logout', 'user.login_sso',
  'user.created', 'user.updated',
  'settings.email.updated', 'settings.ai.updated', 'settings.sla.updated', 'settings.sso.updated',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  'user.login': 'Signed in', 'user.login_failed': 'Failed sign-in', 'user.logout': 'Signed out',
  'user.login_sso': 'Signed in (SSO)', 'user.created': 'User created', 'user.updated': 'User updated',
  'settings.email.updated': 'Email settings updated', 'settings.ai.updated': 'AI settings updated',
  'settings.sla.updated': 'SLA settings updated', 'settings.sso.updated': 'SSO settings updated',
};
