import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/testUtils';

import { ErrorState } from './ErrorState';

describe('ErrorState', () => {
  it('announces the error and retries via the button', async () => {
    const onRetry = vi.fn();
    const { user } = renderWithProviders(<ErrorState onRetry={onRetry} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');

    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders custom title and description without a retry button', () => {
    renderWithProviders(<ErrorState title="Load failed" description="Users unavailable." />);

    expect(screen.getByText('Load failed')).toBeInTheDocument();
    expect(screen.getByText('Users unavailable.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
