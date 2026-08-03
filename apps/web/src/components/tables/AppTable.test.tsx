import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/testUtils';

import { AppTable, type AppTableColumn } from './AppTable';

interface Row {
  id: string;
  name: string;
}

const columns: AppTableColumn<Row>[] = [
  { id: 'name', header: 'Name', render: (row) => row.name, sortable: true },
];

const rows: Row[] = [
  { id: '1', name: 'Ada' },
  { id: '2', name: 'Grace' },
];

describe('AppTable', () => {
  it('sorts via the column header and toggles direction', async () => {
    const onSortChange = vi.fn();
    const { user } = renderWithProviders(
      <AppTable
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        caption="Example table"
        sort={{ field: 'name', direction: 'asc' }}
        onSortChange={onSortChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: /name/i }));
    expect(onSortChange).toHaveBeenCalledWith({ field: 'name', direction: 'desc' });
  });

  it('selects rows and shows the bulk-actions toolbar', async () => {
    const onChange = vi.fn();
    const { user } = renderWithProviders(
      <AppTable
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        caption="Example table"
        selection={{ selectedIds: ['1'], onChange, bulkActions: <button>Bulk delete</button> }}
      />,
    );

    expect(screen.getByText('1 selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bulk delete' })).toBeInTheDocument();

    const [selectAll] = screen.getAllByRole('checkbox', { name: 'Select all rows' });
    await user.click(selectAll!);
    expect(onChange).toHaveBeenCalledWith(['1', '2']);
  });

  it('renders the empty state when there are no rows', () => {
    renderWithProviders(
      <AppTable
        columns={columns}
        rows={[]}
        getRowId={(row: Row) => row.id}
        caption="Empty table"
      />,
    );

    expect(screen.getByText('Nothing here yet')).toBeInTheDocument();
  });

  it('renders the error state with a retry action', async () => {
    const onRetry = vi.fn();
    const { user } = renderWithProviders(
      <AppTable
        columns={columns}
        rows={undefined}
        getRowId={(row: Row) => row.id}
        caption="Broken table"
        error={new Error('boom')}
        onRetry={onRetry}
      />,
    );

    const alert = screen.getByRole('alert');
    await user.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
