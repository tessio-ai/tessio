// SPDX-License-Identifier: AGPL-3.0-only

import { useQuery } from '@tanstack/react-query';
import { getDashboard } from '../api/dashboard';

/** Shared dashboard stats query (sidebar count, dashboard page, tickets triage banner). */
export const useDashboard = (opts?: { enabled?: boolean }) =>
  useQuery({ queryKey: ['dashboard'], queryFn: getDashboard, enabled: opts?.enabled ?? true });
