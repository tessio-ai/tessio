// SPDX-License-Identifier: AGPL-3.0-only

import { request, upload, downloadFile } from './client';

export interface AttachmentRow {
  id: string;
  filename: string;
  size: number;
  mime: string;
  uploadedBy: string | null;
  createdAt: string;
}

export const listTicketAttachments = (id: string): Promise<AttachmentRow[]> =>
  request<AttachmentRow[]>(`/tickets/${id}/attachments`);

export const uploadTicketAttachment = (id: string, file: File): Promise<AttachmentRow> => {
  const form = new FormData();
  form.append('file', file);
  return upload<AttachmentRow>(`/tickets/${id}/attachments`, form);
};

export const deleteAttachment = (id: string) => request<void>(`/attachments/${id}`, { method: 'DELETE' });

export const downloadAttachment = (a: AttachmentRow) => downloadFile(`/attachments/${a.id}`, a.filename);
