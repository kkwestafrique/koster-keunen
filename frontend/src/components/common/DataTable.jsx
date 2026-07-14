import React from 'react';
import { useTranslation } from 'react-i18next';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronsLeft, ChevronsRight } from 'lucide-react';

const PAGE_SIZE_OPTIONS = [5, 15, 30];

// Generic paginated zebra-stripe table used on every list screen.
// Pagination style is deliberately inconsistent on the live site between
// the Beekeeper List (First/Prev/Next/Last) and the Actors List
// (Prev/Next only) — showFirstLast lets each page match its own reference
// rather than forcing one shared style.
export default function DataTable({
  columns,
  rows,
  total,
  page,
  pageSize = 5,
  onPageSizeChange,
  showFirstLast = false,
  onPageChange,
  onRowClick,
  loading,
  emptyMessage,
  testId = 'data-table',
}) {
  const { t } = useTranslation();
  const resolvedEmptyMessage = emptyMessage ?? t('common.noRecordsFound');
  const totalPages = Math.max(1, Math.ceil((total || 0) / pageSize));
  // "X - Y of Z" range format, matching the live site exactly (confirmed
  // against both the Commercial Partners audit's "1 - 5 of 13" and the
  // Contracts audit's "1 - 5 of 37" / empty-state "0 of 0") — not the
  // "Page X of Y" format this used to render.
  const rangeFrom = total > 0 ? (page - 1) * pageSize + 1 : 0;
  const rangeTo = Math.min(page * pageSize, total || 0);

  return (
    <div className="bg-white border border-[#cfd8e6] rounded-[5px] overflow-hidden" data-testid={testId}>
      <Table className="zebra-table">
        <TableHeader>
          <TableRow className="border-b border-[#cfd8e6] hover:bg-transparent">
            {columns.map((col) => (
              <TableHead key={col.key} className="text-[#7089b4] font-bold bg-transparent">
                {col.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="text-center py-8 text-[#7089b4]">
                {t('common.loading')}
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="text-center py-8 text-[#7089b4]" data-testid="data-table-empty">
                {resolvedEmptyMessage}
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

      <div className="flex items-center justify-between px-4 py-3 border-t border-[#cfd8e6]">
        <div className="flex items-center gap-2">
          <span className="text-sm text-[#7089b4]">{t('common.itemsPerPage')}</span>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => onPageSizeChange && onPageSizeChange(Number(v))}
          >
            <SelectTrigger data-testid={`${testId}-page-size`} className="w-[70px] h-8 bg-white border-[#cfd8e6] text-[#032b71]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((n) => (
                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-[#7089b4]" data-testid={`${testId}-summary`}>
            {rangeFrom} - {rangeTo} {t('common.of')} {total || 0}
          </span>
          <Pagination className="justify-end w-auto mx-0">
            <PaginationContent>
              {showFirstLast && (
                <PaginationItem>
                  <button
                    type="button"
                    data-testid={`${testId}-first`}
                    onClick={() => page > 1 && onPageChange(1)}
                    disabled={page <= 1}
                    className={`h-9 w-9 flex items-center justify-center rounded-[3px] ${page <= 1 ? 'opacity-40 pointer-events-none' : 'cursor-pointer hover:bg-[#f5f5f5]'}`}
                  >
                    <ChevronsLeft className="h-4 w-4 text-[#0f48aa]" />
                  </button>
                </PaginationItem>
              )}
              <PaginationItem>
                <PaginationPrevious
                  data-testid={`${testId}-prev`}
                  onClick={() => page > 1 && onPageChange(page - 1)}
                  className={page <= 1 ? 'opacity-40 pointer-events-none' : 'cursor-pointer'}
                />
              </PaginationItem>
              <PaginationItem>
                <PaginationLink isActive className="border-[#0f48aa] text-[#0f48aa] rounded-[3px]">
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
              {showFirstLast && (
                <PaginationItem>
                  <button
                    type="button"
                    data-testid={`${testId}-last`}
                    onClick={() => page < totalPages && onPageChange(totalPages)}
                    disabled={page >= totalPages}
                    className={`h-9 w-9 flex items-center justify-center rounded-[3px] ${page >= totalPages ? 'opacity-40 pointer-events-none' : 'cursor-pointer hover:bg-[#f5f5f5]'}`}
                  >
                    <ChevronsRight className="h-4 w-4 text-[#0f48aa]" />
                  </button>
                </PaginationItem>
              )}
            </PaginationContent>
          </Pagination>
        </div>
      </div>
    </div>
  );
}
