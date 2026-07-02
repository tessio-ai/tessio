// SPDX-License-Identifier: AGPL-3.0-only

/* Client-side Tess intake assist — category detection + deflection/routing copy. */
export function detectCategory(text: string): string | null {
  const t = (text || '').toLowerCase();
  if (/print|laptop|screen|monitor|keyboard|mouse|dock|hardware|device|battery|charger/.test(t)) return 'Hardware';
  if (/wifi|wi-fi|vpn|network|connect|internet|ethernet|slow/.test(t)) return 'Network';
  if (/password|login|log in|access|locked|mfa|2fa|account|permission/.test(t)) return 'Access';
  if (/email|mail|outlook|inbox|calendar/.test(t)) return 'Email';
  if (/app|software|install|update|crash|license|figma|slack|zoom/.test(t)) return 'Software';
  return null;
}

export const DEFLECT: Record<string, { title: string; read: string; solved: string }> = {
  Hardware: { title: 'Fix a printer or device that shows offline', read: '2 min', solved: '82%' },
  Network: { title: 'Reconnect to Wi-Fi & VPN troubleshooting', read: '3 min', solved: '74%' },
  Access: { title: 'Reset your password or re-enroll MFA', read: '1 min', solved: '91%' },
  Email: { title: 'Email not sending or syncing — quick fixes', read: '2 min', solved: '68%' },
  Software: { title: 'Reinstall or update a managed application', read: '4 min', solved: '60%' },
};
export const ROUTE: Record<string, { team: string; sla: string }> = {
  Hardware: { team: 'IT Ops', sla: '~2h' },
  Software: { team: 'IT Ops', sla: '~4h' },
  Network: { team: 'Network', sla: '~3h' },
  Email: { team: 'IT Ops', sla: '~2h' },
  Access: { team: 'Security', sla: '~1h' },
  Other: { team: 'IT Ops', sla: '~4h' },
};
