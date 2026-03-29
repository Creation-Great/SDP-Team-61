import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import EmptyState from '../EmptyState';

describe('EmptyState', () => {
  it('renders default title', () => {
    render(<EmptyState />);
    expect(screen.getByText('Nothing here yet')).toBeTruthy();
  });

  it('renders custom title and description', () => {
    render(<EmptyState title="No items" description="Try adding one" />);
    expect(screen.getByText('No items')).toBeTruthy();
    expect(screen.getByText('Try adding one')).toBeTruthy();
  });

  it('renders action slot', () => {
    render(<EmptyState action={<button>Add Item</button>} />);
    expect(screen.getByText('Add Item')).toBeTruthy();
  });
});
