// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { PublicIntakePage } from '../portal';
import * as portalApi from '../../api/portal';

function wrap(node: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return <QueryClientProvider client={qc}>{node}</QueryClientProvider>;
}
beforeEach(() => vi.restoreAllMocks());
afterEach(() => vi.restoreAllMocks());

const resolved = {
  key: 'report', name: 'Report an issue', categoryKey: 'IT', icon: 'alert',
  theme: { accent: '#4f46e5', layout: 'single', bg: 'plain', font: 'sans', showTess: false, headline: 'Report an issue', intro: 'Tell us', success: 'Thanks!' },
  sections: [{ id: 's', title: 'About', fields: [
    { key: 'title', label: 'Summary', type: 'text', config: {}, validation: {}, required: true, width: 'full', placeholder: 'e.g. printer' },
    { key: 'urgency', label: 'Urgency', type: 'select', options: ['Low', 'High'], config: { options: ['Low', 'High'] }, validation: {}, required: true, width: 'full' },
  ] }],
};

describe('PublicIntakePage', () => {
  it('renders resolved fields and submits the entered values', async () => {
    vi.spyOn(portalApi, 'getPublicForm').mockResolvedValue(resolved as never);
    const submit = vi.spyOn(portalApi, 'submitForm').mockResolvedValue({ id: 't1', number: 42 } as never);
    const onSubmitted = vi.fn();
    render(wrap(<PublicIntakePage formKey="report" onSubmitted={onSubmitted} onBack={vi.fn()} />));
    await waitFor(() => expect(screen.getByText('Report an issue')).toBeInTheDocument());
    await userEvent.type(screen.getByLabelText(/summary/i), 'Printer offline');
    await userEvent.selectOptions(screen.getByLabelText(/urgency/i), 'High');
    await userEvent.click(screen.getByRole('button', { name: /submit request/i }));
    await waitFor(() => expect(submit).toHaveBeenCalledWith('report', { title: 'Printer offline', urgency: 'High' }));
    await waitFor(() => expect(onSubmitted).toHaveBeenCalledWith(42));
  });

  it('marks the empty required field invalid, announces it, and clears on input', async () => {
    vi.spyOn(portalApi, 'getPublicForm').mockResolvedValue(resolved as never);
    const submit = vi.spyOn(portalApi, 'submitForm');
    render(wrap(<PublicIntakePage formKey="report" onSubmitted={vi.fn()} onBack={vi.fn()} />));
    await waitFor(() => expect(screen.getByText('Report an issue')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /submit request/i }));
    // Per-field error, tied to the control via aria-invalid, plus an announced summary.
    await waitFor(() => expect(screen.getByText(/summary is required/i)).toBeInTheDocument());
    expect(screen.getByLabelText(/summary/i)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(submit).not.toHaveBeenCalled();
    // Typing into the field clears its error.
    await userEvent.type(screen.getByLabelText(/summary/i), 'Printer');
    await waitFor(() => expect(screen.queryByText(/summary is required/i)).not.toBeInTheDocument());
    expect(screen.getByLabelText(/summary/i)).not.toHaveAttribute('aria-invalid');
  });

  it('exposes multiselect options as keyboard-operable checkboxes', async () => {
    const multiForm = {
      key: 'access', name: 'Access request', categoryKey: 'IT', icon: 'lock',
      theme: { accent: '#4f46e5', layout: 'single', bg: 'plain', font: 'sans', showTess: false, headline: 'Access request', intro: '', success: 'ok' },
      sections: [{ id: 's', title: 'a', fields: [
        { key: 'apps', label: 'Which apps', type: 'multiselect', options: ['Slack', 'Figma'], config: { options: ['Slack', 'Figma'] }, validation: {}, required: false, width: 'full' },
      ] }],
    };
    vi.spyOn(portalApi, 'getPublicForm').mockResolvedValue(multiForm as never);
    render(wrap(<PublicIntakePage formKey="access" onSubmitted={vi.fn()} onBack={vi.fn()} />));
    await waitFor(() => expect(screen.getByText('Access request')).toBeInTheDocument());
    const slack = screen.getByRole('checkbox', { name: 'Slack' });
    expect(slack).toHaveAttribute('aria-checked', 'false');
    await userEvent.click(slack);
    expect(slack).toHaveAttribute('aria-checked', 'true');
    slack.focus();
    await userEvent.keyboard(' ');
    expect(slack).toHaveAttribute('aria-checked', 'false');
  });

  it('surfaces a server 400 inline', async () => {
    vi.spyOn(portalApi, 'getPublicForm').mockResolvedValue(resolved as never);
    vi.spyOn(portalApi, 'submitForm').mockRejectedValue(Object.assign(new Error('x'), { status: 400, detail: 'urgency: required' }));
    render(wrap(<PublicIntakePage formKey="report" onSubmitted={vi.fn()} onBack={vi.fn()} />));
    await waitFor(() => expect(screen.getByText('Report an issue')).toBeInTheDocument());
    await userEvent.type(screen.getByLabelText(/summary/i), 'x');
    await userEvent.selectOptions(screen.getByLabelText(/urgency/i), 'High');
    await userEvent.click(screen.getByRole('button', { name: /submit request/i }));
    await waitFor(() => expect(screen.getByText(/urgency: required/i)).toBeInTheDocument());
  });
});
