import React from 'react';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
} from '@/components/ui/pagination';

// Generic paginated zebra-stripe table used on every list screen
export default function DataTable({
  columns,
  rows,
  total,
  page,
  pageSize = 25,
  onPageChange,
  onRowClick,
  loading,
  emptyMessage = 'No records found.',
  testId = 'data-table',
}) {
  const totalPages = Math.max(1, Math.ceil((total || 0) / pageSize));

  return (
    <div className="bg-white border border-[#cfd8e6] rounded-[5px] overflow-hidden" data-testid={testId}>
      <Table className="zebra-table">
        <TableHeader>
          <TableRow className="border-b border-[#cfd8e6] hover:bg-transparent">
            {columns.map((col) => (
              <TableHead key={col.key} className="text-[#032b71] font-medium bg-transparent">
                {col.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="text-center py-8 text-[#7089b4]">
                Loading...
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="text-center py-8 text-[#7089b4]" data-testid="data-table-empty">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row, idx) => (
              <TableRow
                key={row.id || idx}
                className="border-b border-[#cfd8e6] cursor-pointer transition-colors"
                onClick={() => onRowClick && onRowClick(row)}
                data-testid={`${testId}-row-${row.id || idx}`}
              >
                {columns.map((col) => (
                  <TableCell key={col.key} className="text-[#032b71] py-3">
                    {col.render ? col.render(row) : row[col.key]}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-[#cfd8e6]">
          <span className="text-sm text-[#7089b4]" data-testid={`${testId}-summary`}>
            Page {page} of {totalPages} &middot; {total} records
          </span>
          <Pagination className="justify-end w-auto mx-0">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  data-testid={`${testId}-prev`}
                  onClick={() => page > 1 && onPageChange(page - 1)}
                  className={page <= 1 ? 'opacity-40 pointer-events-none' : 'cursor-pointer'}
                />
              </PaginationItem>
              <PaginationItem>
                <PaginationLink isActive className="border-[#0f48aa] text-[#0f48aa]">
                  {page}
                </PaginationLink>
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  data-testid={`${testId}-next`}
                  onClick={() => page < totalPages && onPageChange(page + 1)}
                  className={page >= totalPages ? 'opacity-40 pointer-events-none' : 'cursor-pointer'}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}
