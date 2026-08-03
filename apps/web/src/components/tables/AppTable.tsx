import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell, { type TableCellProps } from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import TableSortLabel from '@mui/material/TableSortLabel';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { type SortDirection } from '@/lib/api/types';
import { visuallyHidden } from '@/utils/a11y';

import { EmptyState } from '../feedback/EmptyState';
import { ErrorState } from '../feedback/ErrorState';

export interface AppTableColumn<TRow> {
  id: string;
  header: ReactNode;
  render: (row: TRow) => ReactNode;
  /** Enables the sort control; `onSortChange` receives this column's id. */
  sortable?: boolean;
  align?: TableCellProps['align'];
  width?: number | string;
}

export interface AppTableSort {
  field: string;
  direction: SortDirection;
}

export interface AppTablePaginationProps {
  /** Zero-based page index (MUI TablePagination convention). */
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: number[];
}

export interface AppTableSelectionProps {
  selectedIds: readonly string[];
  onChange: (ids: string[]) => void;
  /** Rendered in the selection toolbar, e.g. a bulk-delete button. */
  bulkActions?: ReactNode;
}

export interface AppTableProps<TRow> {
  columns: readonly AppTableColumn<TRow>[];
  /** `undefined` while loading for the first time. */
  rows: readonly TRow[] | undefined;
  getRowId: (row: TRow) => string;
  /** Accessible table description, announced by screen readers. */
  caption: string;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  emptyState?: ReactNode;
  sort?: AppTableSort | undefined;
  onSortChange?: (sort: AppTableSort) => void;
  pagination?: AppTablePaginationProps;
  selection?: AppTableSelectionProps;
  /** Per-row action cell (icon buttons, menus). */
  rowActions?: (row: TRow) => ReactNode;
  /** Header for the actions column, e.g. t('users:table.actions'). */
  rowActionsHeader?: ReactNode;
  stickyHeader?: boolean;
  maxHeight?: number | string;
}

/**
 * Reusable data table built exclusively on Material UI table primitives.
 * Sorting, pagination and filtering are controlled by the parent, which makes
 * the same component work for client-side and server-side data (see the users
 * feature for a server-side example driven by TanStack Query).
 */
export function AppTable<TRow>({
  columns,
  rows,
  getRowId,
  caption,
  loading = false,
  error,
  onRetry,
  emptyState,
  sort,
  onSortChange,
  pagination,
  selection,
  rowActions,
  rowActionsHeader,
  stickyHeader = false,
  maxHeight,
}: AppTableProps<TRow>) {
  const { t } = useTranslation();

  const columnCount =
    columns.length + (selection !== undefined ? 1 : 0) + (rowActions !== undefined ? 1 : 0);
  const selectedIds = selection?.selectedIds ?? [];
  const rowIds = (rows ?? []).map(getRowId);
  const allSelected = rowIds.length > 0 && rowIds.every((id) => selectedIds.includes(id));
  const someSelected = rowIds.some((id) => selectedIds.includes(id));

  const handleSelectAll = () => {
    if (selection === undefined) {
      return;
    }
    selection.onChange(allSelected ? [] : [...rowIds]);
  };

  const handleSelectRow = (id: string) => {
    if (selection === undefined) {
      return;
    }
    selection.onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((selected) => selected !== id)
        : [...selectedIds, id],
    );
  };

  const skeletonRowCount = pagination?.pageSize ?? 5;

  let body: ReactNode;
  if (error !== undefined && error !== null) {
    body = (
      <TableRow>
        <TableCell colSpan={columnCount} sx={{ border: 0 }}>
          <ErrorState error={error} {...(onRetry !== undefined ? { onRetry } : {})} />
        </TableCell>
      </TableRow>
    );
  } else if (loading && (rows === undefined || rows.length === 0)) {
    body = Array.from({ length: skeletonRowCount }, (_, index) => (
      <TableRow key={`skeleton-${index}`}>
        {selection !== undefined && (
          <TableCell padding="checkbox">
            <Skeleton variant="circular" width={20} height={20} />
          </TableCell>
        )}
        {columns.map((column) => (
          <TableCell key={column.id} align={column.align ?? 'left'}>
            <Skeleton />
          </TableCell>
        ))}
        {rowActions !== undefined && (
          <TableCell align="right">
            <Skeleton width={64} />
          </TableCell>
        )}
      </TableRow>
    ));
  } else if (rows === undefined || rows.length === 0) {
    body = (
      <TableRow>
        <TableCell colSpan={columnCount} sx={{ border: 0 }}>
          {emptyState ?? (
            <EmptyState
              title={t('feedback.empty.title')}
              description={t('feedback.empty.description')}
            />
          )}
        </TableCell>
      </TableRow>
    );
  } else {
    body = rows.map((row) => {
      const id = getRowId(row);
      const isSelected = selectedIds.includes(id);
      return (
        <TableRow key={id} hover selected={isSelected} sx={{ opacity: loading ? 0.6 : 1 }}>
          {selection !== undefined && (
            <TableCell padding="checkbox">
              <Checkbox
                checked={isSelected}
                onChange={() => {
                  handleSelectRow(id);
                }}
                slotProps={{ input: { 'aria-label': t('table.selectRow') } }}
              />
            </TableCell>
          )}
          {columns.map((column) => (
            <TableCell key={column.id} align={column.align ?? 'left'}>
              {column.render(row)}
            </TableCell>
          ))}
          {rowActions !== undefined && (
            <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
              {rowActions(row)}
            </TableCell>
          )}
        </TableRow>
      );
    });
  }

  return (
    <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
      {selection !== undefined && selectedIds.length > 0 && (
        <Toolbar
          variant="dense"
          sx={{ bgcolor: 'action.selected', justifyContent: 'space-between', gap: 2 }}
        >
          <Typography variant="subtitle2" component="p">
            {t('table.selectedCount', { count: selectedIds.length })}
          </Typography>
          <Box>{selection.bulkActions}</Box>
        </Toolbar>
      )}

      <TableContainer sx={maxHeight !== undefined ? { maxHeight } : undefined}>
        <Table stickyHeader={stickyHeader} aria-label={caption}>
          <Box component="caption" sx={visuallyHidden}>
            {caption}
          </Box>
          <TableHead>
            <TableRow>
              {selection !== undefined && (
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={allSelected}
                    indeterminate={someSelected && !allSelected}
                    onChange={handleSelectAll}
                    disabled={rowIds.length === 0}
                    slotProps={{ input: { 'aria-label': t('table.selectAll') } }}
                  />
                </TableCell>
              )}
              {columns.map((column) => {
                const isSorted = sort?.field === column.id;
                const direction = isSorted ? sort.direction : 'asc';
                return (
                  <TableCell
                    key={column.id}
                    align={column.align ?? 'left'}
                    sx={column.width !== undefined ? { width: column.width } : undefined}
                    sortDirection={isSorted ? direction : false}
                  >
                    {column.sortable === true && onSortChange !== undefined ? (
                      <TableSortLabel
                        active={isSorted}
                        direction={direction}
                        onClick={() => {
                          onSortChange({
                            field: column.id,
                            direction: isSorted && direction === 'asc' ? 'desc' : 'asc',
                          });
                        }}
                      >
                        {column.header}
                        {isSorted && (
                          <Box component="span" sx={visuallyHidden}>
                            {direction === 'desc'
                              ? t('table.sortedDescending')
                              : t('table.sortedAscending')}
                          </Box>
                        )}
                      </TableSortLabel>
                    ) : (
                      column.header
                    )}
                  </TableCell>
                );
              })}
              {rowActions !== undefined && <TableCell align="right">{rowActionsHeader}</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>{body}</TableBody>
        </Table>
      </TableContainer>

      {pagination !== undefined && (
        <TablePagination
          component="div"
          count={pagination.total}
          page={pagination.page}
          rowsPerPage={pagination.pageSize}
          rowsPerPageOptions={pagination.pageSizeOptions ?? [10, 25, 50]}
          onPageChange={(_event, page) => {
            pagination.onPageChange(page);
          }}
          onRowsPerPageChange={(event) => {
            pagination.onPageSizeChange(Number(event.target.value));
          }}
          labelRowsPerPage={t('table.rowsPerPage')}
          labelDisplayedRows={({ from, to, count }) =>
            t('table.displayedRows', { from, to, count })
          }
        />
      )}
    </Paper>
  );
}
