// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from './button';

describe('Button', () => {
  it('renders its children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('applies variant-specific classes and not the default ones', () => {
    render(<Button variant="outline">x</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('border-input');
    expect(button).not.toHaveClass('bg-primary');
  });

  it('renders as the child element when asChild is true', () => {
    render(
      <Button asChild>
        <a href="/foo">Link</a>
      </Button>,
    );
    expect(screen.getByRole('link', { name: 'Link' })).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
