import React, { useState } from 'react';
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
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const resolvedEmptyMessage = emptyMessage ?? t('common.noRecordsFound');
  const totalPages = Math.max(1, Math.ceil((total || 0) / pageSize));

  // Gap 14: no table anywhere could be sorted by clicking a column -- the
  // same limitation as the real platform. Opt-in per column via
  // `sortable: true`, so existing pages are completely unaffected unless
  // they explicitly enable it.
  //
  // Deliberately CLIENT-side, sorting only the rows currently on screen.
  // Server-side sorting across the whole dataset would need a real `order`
  // param threaded through every list hook and every query -- a much
  // larger change. Sorting the visible page is genuinely useful and
  // honest about what it does; it just isn't a full-dataset sort.
  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const displayRows = React.useMemo(() => {
    if (!sortKey) return rows;
    const sorted = [...rows].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return av - bv;
      return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' });
    });
    return sortDir === 'asc' ? sorted : sorted.reverse();
  }, [rows, sortKey, sortDir]);

  // "X - Y of Z" range format, matching the live site exactly (confirmed
  // against both the Commercial Partners audit's "1 - 5 of 13" and the
  // Contracts audit's "1 - 5 of 37" / empty-state "0 of 0") — not the
  // "Page X of Y" format this used to render.
  const rangeFrom = total > 0 ? (page - 1) * pageSize + 1 : 0;
  const rangeTo = Math.min(page * pageSize, total || 0);

  return (
    <div className="bg-white border border-[#cfd8e6] rounded-[5px]" data-testid={testId}>
      <Table className="zebra-table">
        <TableHeader>
          <TableRow className="border-b border-[#cfd8e6] hover:bg-transparent">
            {columns.map((col) => (
              <TableHead key={col.key} className="text-[#5a6f9a] font-bold bg-transparent">
                {col.sortable ? (
                  <button
                    type="button"
                    data-testid={`${testId}-sort-${col.key}`}
                    onClick={() => handleSort(col.key)}
                    className="flex items-center gap-1 hover:text-[#032b71] transition-colors"
                  >
                    {col.label}
                    <span className="text-[10px]">
                      {sortKey === col.key ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
                    </span>
                  </button>
                ) : (
                  col.label
                )}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="text-center py-8 text-[#5a6f9a]">
                {t('common.loading')}
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="text-center py-8 text-[#5a6f9a]" data-testid="data-table-empty">
                {resolvedEmptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            displayRows.map((row, idx) => (
              // Real gap found via independent audit (C4): table rows
              // were mouse-only -- keyboard users couldn't Tab to a row
              // or press Enter to open it, and screen readers had no
              // indication a row was interactive at all. Only made
              // focusable/keyboard-operable when there's actually a
              // click handler to trigger -- a table with no
              // onRowClick genuinely isn't interactive, so it
              // shouldn't claim to be. Fixed once here, shared by
              // every table in the app.
              <TableRow
                key={row.id || idx}
                className={`border-b border-[#cfd8e6] transition-colors ${onRowClick ? 'cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0f48aa] focus-visible:-outline-offset-2' : ''}`}
                onClick={() => onRowClick && onRowClick(row)}
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={onRowClick ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onRowClick(row);
                  }
                } : undefined}
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
        {/* Real bug found via independent audit (BUG-20): on Products
            (and the same applies to Verifications), pageSize is
            intentionally set to match the full row count -- a
            deliberate, correct choice for a small, fixed list, not a
            bug in itself. But since that computed value never matches
            one of this selector's fixed options ([5, 15, 30]), the
            control rendered with no visible selection at all, and
            picking a value did nothing since these pages never pass a
            real onPageSizeChange handler. Hiding the selector entirely
            when there's no real handler to call is more honest than
            showing one that looks broken. */}
        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-[#5a6f9a]">{t('common.itemsPerPage')}</span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => onPageSizeChange(Number(v))}
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
        )}

        <div className="flex items-center gap-3">
          <span className="text-sm text-[#5a6f9a] min-w-[80px]" data-testid={`${testId}-summary`}>
            {loading ? '' : `${rangeFrom} - ${rangeTo} ${t('common.of')} ${total || 0}`}
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
              {/* Real gap found via the newest audit (pagination "walk
                  only"): only the current page number was shown, with
                  no way to jump directly to a specific nearby page --
                  first/prev/next/last were the only real navigation.
                  Shows up to 5 real, clickable page numbers centered on
                  the current page, adjusting the window near the start
                  or end of the range so it never shows fewer than 5
                  numbers when at least 5 pages exist. */}
              {(() => {
                const maxButtons = 5;
                let start = Math.max(1, page - Math.floor(maxButtons / 2));
                let end = Math.min(totalPages, start + maxButtons - 1);
                start = Math.max(1, end - maxButtons + 1);
                const pageNumbers = [];
                for (let n = start; n <= end; n++) pageNumbers.push(n);
                return pageNumbers.map((n) => (
                  <PaginationItem key={n}>
                    <PaginationLink
                      isActive={n === page}
                      data-testid={`${testId}-page-${n}`}
                      tabIndex={0}
                      onClick={() => n !== page && onPageChange(n)}
                      onKeyDown={(e) => {
                        if ((e.key === 'Enter' || e.key === ' ') && n !== page) {
                          e.preventDefault();
                          onPageChange(n);
                        }
                      }}
                      className={`rounded-[3px] cursor-pointer ${n === page ? 'border-[#0f48aa] text-[#0f48aa]' : 'text-[#5a6f9a]'}`}
                    >
                      {n}
                    </PaginationLink>
                  </PaginationItem>
                ));
              })()}
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
