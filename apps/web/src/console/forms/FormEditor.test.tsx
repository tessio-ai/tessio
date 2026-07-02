// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { FormEditor } from './FormEditor';
import * as formsApi from '../../api/forms';
import * as schemasApi from '../../api/schemas';
import * as portalApi from '../../api/portal';

function wrap(node: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return <QueryClientProvider client={qc}>{node}</QueryClientProvider>;
}
beforeEach(() => vi.restoreAllMocks());
afterEach(() => vi.restoreAllMocks());

const form = { id: 'f1', name: 'Report', key: 'report', categoryKey: 'IT', icon: 'alert', status: 'draft', targetSchemaId: 's1',
  theme: { accent: '#4f46e5', layout: 'single', bg: 'plain', font: 'sans', showTess: true, headline: 'Report', intro: '', success: '' },
  definition: { sections: [{ id: 's1', title: 'Details', order: 0, fields: [{ fieldKey: 'title', width: 'full' }] }] }, updatedAt: '', createdAt: '', description: null, orgId: 'o' };
const schema = { id: 's1', kind: 'ticket', key: 't', name: 'Incident', version: 1, status: 'published', definition: { fields: [{ key: 'title', label: 'Title', type: 'text', required: true, order: 0, width: 'full' }] } };

function mockLoaded() {
  vi.spyOn(formsApi, 'getForm').mockResolvedValue(form as never);
  vi.spyOn(schemasApi, 'getSchema').mockResolvedValue(schema as never);
  vi.spyOn(portalApi, 'getPortalSettings').mockResolvedValue({ orgId: 'o', brandName: 'A', logo: '', heroHeadline: 'H', heroIntro: '', accent: '#000', showTess: true, categories: [], updatedAt: '' } as never);
}

describe('FormEditor', () => {
  it('loads a form and switches tabs', async () => {
    mockLoaded();
    render(wrap(<FormEditor formId="f1" go={vi.fn()} />));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Report' })).toBeInTheDocument());
    await userEvent.click(screen.getByRole('tab', { name: /layout/i }));
    expect(screen.getByDisplayValue('Details')).toBeInTheDocument();
  });

  it('Publish surfaces a 400 validation error inline', async () => {
    mockLoaded();
    vi.spyOn(formsApi, 'updateForm').mockRejectedValue(Object.assign(new Error('x'), { status: 400, detail: 'required field "title" is not collected by the form' }));
    render(wrap(<FormEditor formId="f1" go={vi.fn()} />));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Report' })).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /publish/i }));
    await waitFor(() => expect(screen.getByText(/is not collected by the form/i)).toBeInTheDocument());
  });

  it('sources the Settings category options from portal settings', async () => {
    mockLoaded();
    vi.spyOn(portalApi, 'getPortalSettings').mockResolvedValue({ orgId: 'o', brandName: 'A', logo: '', heroHeadline: 'H', heroIntro: '', accent: '#000', showTess: true, categories: [{ key: 'facilities', label: 'Facilities', icon: 'building', color: '#f59e0b', order: 0, visible: true }], updatedAt: '' } as never);
    render(wrap(<FormEditor formId="f1" go={vi.fn()} />));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Report' })).toBeInTheDocument());
    await userEvent.click(screen.getByRole('tab', { name: /settings/i }));
    // Category options show the human label as their text (value is the key 'facilities').
    await waitFor(() => expect(screen.getByRole('option', { name: 'Facilities' })).toBeInTheDocument());
  });
});
