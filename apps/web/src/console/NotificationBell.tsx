// SPDX-License-Identifier: AGPL-3.0-only

import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { IconButton, relTime } from './ui';
import { getNotifications, markRead, markAllRead } from '../api/notifications';

type Go = (screen: string, extra?: { ticketId?: string }) => void;

export function NotificationBell({ go }: { go: Go }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: getNotifications,
    refetchInterval: 30000,
  });

  const unread = data?.unreadCount ?? 0;
  const items = data?.items ?? [];

  const onMarkRead = async (id: string, ticketId: string | null) => {
    await markRead(id);
    void qc.invalidateQueries({ queryKey: ['notifications'] });
    if (ticketId) {
      go('tickets', { ticketId });
      setOpen(false);
    }
  };

  const onMarkAllRead = async () => {
    await markAllRead();
    void qc.invalidateQueries({ queryKey: ['notifications'] });
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <IconButton
        name="bell"
        title="Notifications"
        onClick={() => setOpen((o) => !o)}
        style={{ position: 'relative' }}
      />
      {unread > 0 && (
        <span style={{
          position: 'absolute',
          top: 2,
          right: 2,
          minWidth: 16,
          height: 16,
          borderRadius: 8,
          background: 'var(--danger)',
          border: '1.5px solid var(--background)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 10,
          fontWeight: 600,
          color: '#fff',
          pointerEvents: 'none',
          padding: '0 3px',
        }}>
          {unread > 99 ? '99+' : unread}
        </span>
      )}

      {open && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 49 }}
            onClick={() => setOpen(false)}
          />
          <div style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: 360,
            maxHeight: 480,
            overflowY: 'auto',
            background: 'var(--background)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 50,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 600, fontSize: 'var(--t-small)' }}>Notifications</div>
              {unread > 0 && (
                <button
                  type="button"
                  onClick={onMarkAllRead}
                  style={{ all: 'unset', cursor: 'pointer', fontSize: 'var(--t-caption)', color: 'var(--primary)' }}
                >
                  Mark all read
                </button>
              )}
            </div>

            {items.length === 0 ? (
              <div style={{ padding: '24px 14px', textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 'var(--t-small)' }}>
                No notifications yet.
              </div>
            ) : (
              items.map((n) => (
                <div
                  key={n.id}
                  onClick={() => void onMarkRead(n.id, n.ticketId)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                    padding: '10px 14px',
                    cursor: n.ticketId ? 'pointer' : 'default',
                    background: n.readAt ? undefined : 'var(--primary-tint)',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {!n.readAt && (
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0 }} />
                    )}
                    <span style={{ fontWeight: n.readAt ? 400 : 500, fontSize: 'var(--t-small)', flex: 1, minWidth: 0 }}>{n.title}</span>
                    <span style={{ fontSize: 'var(--t-caption)', color: 'var(--muted-foreground)', flexShrink: 0 }}>
                      {relTime(new Date(n.createdAt).getTime())}
                    </span>
                  </div>
                  {n.snippet && (
                    <div style={{ fontSize: 'var(--t-caption)', color: 'var(--muted-foreground)', paddingLeft: n.readAt ? 0 : 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {n.snippet}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
