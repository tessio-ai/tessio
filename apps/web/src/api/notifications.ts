// SPDX-License-Identifier: AGPL-3.0-only

import { request } from './client';

export interface NotificationItem {
  id: string;
  orgId: string;
  userId: string;
  ticketId: string | null;
  type: string;
  title: string;
  snippet: string;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationsView {
  items: NotificationItem[];
  unreadCount: number;
}

export interface NotificationPrefs {
  emailEnabled: boolean;
  assigned: boolean;
  replies: boolean;
  statusChanges: boolean;
}

export const getNotifications = () => request<NotificationsView>('/notifications');
export const markRead = (id: string) =>
  request<void>(`/notifications/${id}/read`, { method: 'POST' });
export const markAllRead = () =>
  request<void>('/notifications/read-all', { method: 'POST' });

export const getNotificationPrefs = () => request<NotificationPrefs>('/me/notification-prefs');
export const putNotificationPrefs = (prefs: NotificationPrefs) =>
  request<NotificationPrefs>('/me/notification-prefs', { method: 'PUT', body: JSON.stringify(prefs) });
