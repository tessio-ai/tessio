// SPDX-License-Identifier: AGPL-3.0-only

/* Mock data — mirrors the API shapes in the spec (§11). Ported from the design handoff. */

export interface User {
  id: string;
  name: string;
  initials: string;
  color: string;
  role: string;
}
export interface Team {
  id: string;
  name: string;
}
export interface Ticket {
  id: string;
  number: number;
  type: string;
  title: string;
  status: string;
  priority: string;
  requesterId: string;
  assigneeId: string | null;
  teamId: string;
  updatedAt: number;
  createdAt: number;
  dueAt: number | null;
  data: Record<string, string>;
}

export const USERS: Record<string, User> = {
  sam: { id: 'sam', name: 'Sam Rivera', initials: 'SR', color: '#6366f1', role: 'Agent' },
  jordan: { id: 'jordan', name: 'Jordan Lee', initials: 'JL', color: '#0ea5e9', role: 'Agent' },
  priya: { id: 'priya', name: 'Priya Nair', initials: 'PN', color: '#10b981', role: 'Agent' },
  marcus: { id: 'marcus', name: 'Marcus Bell', initials: 'MB', color: '#f59e0b', role: 'Manager' },
  elena: { id: 'elena', name: 'Elena Duarte', initials: 'ED', color: '#ec4899', role: 'Agent' },
  dana: { id: 'dana', name: 'Dana Kohl', initials: 'DK', color: '#8b5cf6', role: 'Requester' },
  tomas: { id: 'tomas', name: 'Tomás Vega', initials: 'TV', color: '#14b8a6', role: 'Requester' },
  amara: { id: 'amara', name: 'Amara Osei', initials: 'AO', color: '#ef4444', role: 'Requester' },
  ruben: { id: 'ruben', name: 'Rubén Soto', initials: 'RS', color: '#3b82f6', role: 'Requester' },
  wei: { id: 'wei', name: 'Wei Zhang', initials: 'WZ', color: '#84cc16', role: 'Requester' },
};

export const TEAMS: Record<string, Team> = {
  itops: { id: 'itops', name: 'IT Ops' },
  net: { id: 'net', name: 'Network' },
  sec: { id: 'sec', name: 'Security' },
  fac: { id: 'fac', name: 'Facilities' },
  onb: { id: 'onb', name: 'Onboarding' },
};

export const STATUS_MAP: Record<string, { label: string; tone: string }> = {
  open: { label: 'Open', tone: 'info' },
  new: { label: 'New', tone: 'info' },
  in_progress: { label: 'In progress', tone: 'warning' },
  pending: { label: 'Pending', tone: 'warning' },
  on_hold: { label: 'On hold', tone: 'neutral' },
  resolved: { label: 'Resolved', tone: 'success' },
  closed: { label: 'Closed', tone: 'neutral' },
};
export const PRIORITY_MAP: Record<string, { label: string; rank: number }> = {
  low: { label: 'Low', rank: 1 },
  medium: { label: 'Medium', rank: 2 },
  high: { label: 'High', rank: 3 },
  urgent: { label: 'Urgent', rank: 4 },
};
export const TYPE_MAP: Record<string, { label: string; icon: string }> = {
  incident: { label: 'Incident', icon: 'alert' },
  request: { label: 'Service request', icon: 'inbox' },
  problem: { label: 'Problem', icon: 'zap' },
  change: { label: 'Change', icon: 'refresh' },
};

const H = 3600e3;
const D = 24 * H;
const now = Date.now();
export const NOW = now;

export const TICKETS: Ticket[] = [
  { id: 't142', number: 142, type: 'incident', title: 'Printer offline in Bldg C, 3rd floor', status: 'open', priority: 'high', requesterId: 'dana', assigneeId: 'sam', teamId: 'itops', updatedAt: now - 2 * H, createdAt: now - 3 * D, dueAt: now + 4 * H, data: { category: 'Hardware', location: 'Bldg C / 3F', asset: 'PRN-C312', channel: 'Email', description: 'The shared HP LaserJet by the east stairwell shows offline for everyone on the floor. Power-cycled twice, no change.' } },
  { id: 't141', number: 141, type: 'request', title: 'VPN access request for new contractor', status: 'pending', priority: 'medium', requesterId: 'tomas', assigneeId: null, teamId: 'net', updatedAt: now - 5 * H, createdAt: now - 1 * D, dueAt: now + 20 * H, data: { category: 'Access', location: 'Remote', asset: '—', channel: 'Portal', description: 'Contractor starting Monday needs VPN + access to the staging environment. Manager approval attached.' } },
  { id: 't140', number: 140, type: 'incident', title: 'Email delivery delayed across Sales', status: 'in_progress', priority: 'urgent', requesterId: 'amara', assigneeId: 'priya', teamId: 'itops', updatedAt: now - 40 * 60e3, createdAt: now - 6 * H, dueAt: now - 1 * H, data: { category: 'Email', location: 'All sites', asset: 'MX-relay-02', channel: 'Phone', description: 'Outbound mail from the Sales DL is taking 30–60 min. Suspect greylisting on the relay after last night’s change.' } },
  { id: 't139', number: 139, type: 'request', title: 'New laptop for design onboarding — Wei Zhang', status: 'open', priority: 'medium', requesterId: 'wei', assigneeId: 'elena', teamId: 'onb', updatedAt: now - 7 * H, createdAt: now - 2 * D, dueAt: now + 2 * D, data: { category: 'Hardware', location: 'Bldg A / 2F', asset: '—', channel: 'Portal', description: 'Standard design spec: 16" laptop, 32GB, external monitor + dock. Start date next Wednesday.' } },
  { id: 't138', number: 138, type: 'incident', title: 'Wi-Fi drops in the 4th-floor meeting rooms', status: 'on_hold', priority: 'medium', requesterId: 'ruben', assigneeId: 'sam', teamId: 'net', updatedAt: now - 1 * D, createdAt: now - 4 * D, dueAt: now + 3 * D, data: { category: 'Network', location: 'Bldg B / 4F', asset: 'AP-B41', channel: 'Email', description: 'Clients disassociate every few minutes in rooms 4.2–4.5. Waiting on the replacement access point from vendor.' } },
  { id: 't137', number: 137, type: 'request', title: 'Software license — Figma Organization seat', status: 'resolved', priority: 'low', requesterId: 'dana', assigneeId: 'jordan', teamId: 'itops', updatedAt: now - 2 * D, createdAt: now - 5 * D, dueAt: now - 1 * D, data: { category: 'Software', location: 'Remote', asset: '—', channel: 'Portal', description: 'Requesting a Figma org seat for the new PM. Cost-center 4021.' } },
  { id: 't136', number: 136, type: 'incident', title: "Shared drive 'Marketing' read-only for everyone", status: 'open', priority: 'high', requesterId: 'amara', assigneeId: null, teamId: 'itops', updatedAt: now - 3 * H, createdAt: now - 9 * H, dueAt: now + 6 * H, data: { category: 'Storage', location: 'All sites', asset: 'FS-03', channel: 'Phone', description: 'Whole Marketing team can read but not write to the marketing share since this morning. Likely a permissions sync issue.' } },
  { id: 't135', number: 135, type: 'problem', title: 'Recurring crashes in the time-tracking app', status: 'in_progress', priority: 'high', requesterId: 'tomas', assigneeId: 'priya', teamId: 'itops', updatedAt: now - 8 * H, createdAt: now - 7 * D, dueAt: now + 1 * D, data: { category: 'Software', location: 'All sites', asset: 'APP-TT', channel: 'Portal', description: 'Clock-in app crashes on submit for ~12 users on the new build. Collecting logs to find the common factor.' } },
  { id: 't134', number: 134, type: 'request', title: 'Offboarding — revoke access for J. Park', status: 'pending', priority: 'high', requesterId: 'marcus', assigneeId: 'elena', teamId: 'sec', updatedAt: now - 11 * H, createdAt: now - 1 * D, dueAt: now + 8 * H, data: { category: 'Access', location: 'HQ', asset: '—', channel: 'Internal', description: 'Final day Friday. Revoke SSO, VPN, badge, and reclaim the laptop. Checklist attached.' } },
  { id: 't133', number: 133, type: 'incident', title: "Conference room display won't detect HDMI", status: 'resolved', priority: 'low', requesterId: 'ruben', assigneeId: 'sam', teamId: 'fac', updatedAt: now - 3 * D, createdAt: now - 4 * D, dueAt: now - 2 * D, data: { category: 'AV', location: 'Bldg A / Rm Aspen', asset: 'AV-ASPEN', channel: 'Email', description: "Display in Aspen shows 'no signal' over HDMI. Replaced the cable, working now." } },
  { id: 't132', number: 132, type: 'request', title: 'Increase mailbox quota for Finance shared inbox', status: 'open', priority: 'low', requesterId: 'wei', assigneeId: 'jordan', teamId: 'itops', updatedAt: now - 14 * H, createdAt: now - 2 * D, dueAt: now + 4 * D, data: { category: 'Email', location: 'Remote', asset: 'MBX-FIN', channel: 'Portal', description: 'Finance shared inbox at 95% of quota. Requesting bump from 10GB to 25GB.' } },
  { id: 't131', number: 131, type: 'incident', title: 'Badge reader at south entrance unresponsive', status: 'in_progress', priority: 'urgent', requesterId: 'amara', assigneeId: 'sam', teamId: 'fac', updatedAt: now - 25 * 60e3, createdAt: now - 5 * H, dueAt: now + 30 * 60e3, data: { category: 'Access', location: 'Bldg C / South', asset: 'RDR-CS1', channel: 'Phone', description: 'South entrance badge reader dark — staff funneling through the loading dock. Facilities + Security paged.' } },
  { id: 't130', number: 130, type: 'change', title: 'Scheduled firmware update — core switch stack', status: 'on_hold', priority: 'medium', requesterId: 'marcus', assigneeId: 'priya', teamId: 'net', updatedAt: now - 1 * D, createdAt: now - 3 * D, dueAt: now + 5 * D, data: { category: 'Network', location: 'DC-1', asset: 'SW-CORE-1', channel: 'Internal', description: 'Maintenance window Saturday 02:00. Change record pending CAB approval.' } },
  { id: 't129', number: 129, type: 'request', title: 'Password reset — locked out after MFA reset', status: 'closed', priority: 'medium', requesterId: 'dana', assigneeId: 'jordan', teamId: 'sec', updatedAt: now - 4 * D, createdAt: now - 4 * D, dueAt: now - 3 * D, data: { category: 'Access', location: 'Remote', asset: '—', channel: 'Phone', description: 'User locked out after re-enrolling MFA on a new phone. Verified identity, reset and confirmed login.' } },
];

export interface TimelineEvent {
  kind: string;
  who: string;
  at: number;
  to?: string;
  from?: string;
  internal?: boolean;
  body?: string;
}

export const TIMELINE: Record<string, TimelineEvent[]> = {
  t142: [
    { kind: 'created', who: 'dana', at: now - 3 * D },
    { kind: 'assigned', who: 'jordan', to: 'sam', at: now - 3 * D + 20 * 60e3 },
    { kind: 'comment', who: 'sam', at: now - 2 * D, internal: false, body: "Hi Dana — thanks for flagging. Can you confirm the printer's display shows any error code, or is the panel blank?" },
    { kind: 'comment', who: 'dana', at: now - 2 * D + 2 * H, internal: false, body: 'Panel is lit but says "Ready" — yet nothing prints and the queue just stacks up. Three of us tried.' },
    { kind: 'priority', who: 'sam', from: 'medium', to: 'high', at: now - 1 * D },
    { kind: 'comment', who: 'sam', at: now - 5 * H, internal: true, body: 'Print server shows the queue paused on this device. Looks like a stuck job from a CAD export is blocking everything. Clearing it remotely.' },
    { kind: 'status', who: 'sam', from: 'pending', to: 'open', at: now - 2 * H },
  ],
};

export interface SavedView {
  id: string;
  name: string;
  filter: (t: Ticket) => boolean;
}
export const SAVED_VIEWS: SavedView[] = [
  { id: 'all', name: 'All', filter: () => true },
  { id: 'my_open', name: 'My open', filter: (t) => t.assigneeId === 'sam' && !['resolved', 'closed'].includes(t.status) },
  { id: 'unassigned', name: 'Unassigned', filter: (t) => !t.assigneeId && !['resolved', 'closed'].includes(t.status) },
  { id: 'breaching', name: 'Breaching', filter: (t) => !!t.dueAt && t.dueAt < now && !['resolved', 'closed'].includes(t.status) },
];

export interface FormFieldDef {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  width?: number;
  placeholder?: string;
  hint?: string;
  options?: string[];
}
export const TICKET_SCHEMA: Record<string, { sections: { title: string; fields: FormFieldDef[] }[] }> = {
  incident: {
    sections: [
      { title: 'Incident details', fields: [
        { key: 'title', label: 'Title', type: 'text', required: true, width: 2, placeholder: 'Short summary of the issue' },
        { key: 'category', label: 'Category', type: 'select', width: 1, options: ['Hardware', 'Software', 'Network', 'Email', 'Storage', 'Access', 'AV'] },
        { key: 'priority', label: 'Priority', type: 'select', width: 1, options: ['Low', 'Medium', 'High', 'Urgent'] },
        { key: 'location', label: 'Location', type: 'text', width: 1, placeholder: 'Bldg / floor' },
        { key: 'asset', label: 'Affected asset', type: 'text', width: 1, placeholder: 'Asset tag', hint: 'Optional — link a CMDB record' },
        { key: 'description', label: 'Description', type: 'textarea', required: true, width: 2, placeholder: "What happened, who's affected, what you've tried…" },
      ] },
    ],
  },
  request: {
    sections: [
      { title: 'Request details', fields: [
        { key: 'title', label: 'Title', type: 'text', required: true, width: 2, placeholder: 'What do you need?' },
        { key: 'category', label: 'Category', type: 'select', width: 1, options: ['Hardware', 'Software', 'Access', 'Email'] },
        { key: 'priority', label: 'Priority', type: 'select', width: 1, options: ['Low', 'Medium', 'High', 'Urgent'] },
        { key: 'location', label: 'For (location)', type: 'text', width: 1, placeholder: 'Bldg / floor / Remote' },
        { key: 'costcenter', label: 'Cost center', type: 'text', width: 1, placeholder: 'e.g. 4021', hint: 'Required for paid items' },
        { key: 'description', label: 'Details', type: 'textarea', required: true, width: 2, placeholder: 'Describe the request…' },
      ] },
    ],
  },
};
