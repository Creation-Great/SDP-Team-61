import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Button from '../Button';

describe('Button', () => {
  it('renders children text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeTruthy();
  });

  it('applies variant classes', () => {
    const { container } = render(<Button variant="danger">Delete</Button>);
    const btn = container.querySelector('button');
    expect(btn.className).toContain('bg-red');
  });

  it('shows loading spinner when loading', () => {
    const { container } = render(<Button loading>Saving</Button>);
    const svg = container.querySelector('svg.animate-spin');
    expect(svg).toBeTruthy();
  });

  it('disables button when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByText('Disabled').closest('button').disabled).toBe(true);
  });
});
