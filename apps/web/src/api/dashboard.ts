// SPDX-License-Identifier: AGPL-3.0-only

import { request } from './client';

export interface RecentTriage {
  ticketId: string;
  number: number | null;
  title: string;
  category: string | null;
  priority: string | null;
  confidence: number | null;
  at: string;
}

export interface DashboardStats {
  myOpen: number;
  unassigned: number;
  dueToday: number;
  breaching: number;
  openByStatus: { status: string; count: number }[];
  series: { date: string; created: number; resolved: number }[];
  today: { created: number; resolved: number; triaged: number };
  tess: { enabled: boolean; triaged: number; indexed: number; flagged: number };
  recentTess: RecentTriage[];
}

export const getDashboard = (): Promise<DashboardStats> => request<DashboardStats>('/dashboard');
