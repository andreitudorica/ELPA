import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import { type Meta, type StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { AppTable, type AppTableColumn } from './AppTable';

interface DemoRow {
  id: string;
  name: string;
  email: string;
  status: 'active' | 'invited';
}

const columns: AppTableColumn<DemoRow>[] = [
  { id: 'name', header: 'Name', render: (row) => row.name, sortable: true },
  { id: 'email', header: 'Email', render: (row) => row.email, sortable: true },
  {
    id: 'status',
    header: 'Status',
    render: (row) => (
      <Chip
        label={row.status}
        color={row.status === 'active' ? 'success' : 'info'}
        variant="outlined"
      />
    ),
  },
];

const rows: DemoRow[] = [
  { id: '1', name: 'Ada Lovelace', email: 'ada@acme.io', status: 'active' },
  { id: '2', name: 'Grace Hopper', email: 'grace@acme.io', status: 'active' },
  { id: '3', name: 'Alan Turing', email: 'alan@acme.io', status: 'invited' },
];

const meta = {
  title: 'Tables/AppTable',
  component: AppTable,
} satisfies Meta<typeof AppTable>;

export default meta;

export const Default: StoryObj = {
  render: () => (
    <AppTable<DemoRow>
      columns={columns}
      rows={rows}
      getRowId={(row) => row.id}
      caption="Demo users"
      sort={{ field: 'name', direction: 'asc' }}
      onSortChange={() => undefined}
      pagination={{
        page: 0,
        pageSize: 10,
        total: 3,
        onPageChange: () => undefined,
        onPageSizeChange: () => undefined,
      }}
      rowActions={(row) => (
        <IconButton size="small" aria-label={`Edit ${row.name}`}>
          <EditOutlinedIcon fontSize="small" />
        </IconButton>
      )}
    />
  ),
};

export const WithSelection: StoryObj = {
  render: function WithSelectionStory() {
    const [selected, setSelected] = useState<string[]>(['1']);
    return (
      <AppTable<DemoRow>
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        caption="Demo users"
        selection={{
          selectedIds: selected,
          onChange: setSelected,
          bulkActions: (
            <Button color="error" size="small">
              Delete selected
            </Button>
          ),
        }}
      />
    );
  },
};

export const Loading: StoryObj = {
  render: () => (
    <AppTable<DemoRow>
      columns={columns}
      rows={undefined}
      getRowId={(row) => row.id}
      caption="Demo users"
      loading
      pagination={{
        page: 0,
        pageSize: 5,
        total: 0,
        onPageChange: () => undefined,
        onPageSizeChange: () => undefined,
      }}
    />
  ),
};

export const Empty: StoryObj = {
  render: () => (
    <AppTable<DemoRow>
      columns={columns}
      rows={[]}
      getRowId={(row) => row.id}
      caption="Demo users"
    />
  ),
};

export const ErrorRow: StoryObj = {
  name: 'Error',
  render: () => (
    <AppTable<DemoRow>
      columns={columns}
      rows={undefined}
      getRowId={(row) => row.id}
      caption="Demo users"
      error={new Error('Request failed')}
      onRetry={() => undefined}
    />
  ),
};
