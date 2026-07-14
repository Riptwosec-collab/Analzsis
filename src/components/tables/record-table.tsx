"use client";

import { useState } from "react";
import { ArrowDown, ArrowDownUp, ArrowUp, ChevronLeft, ChevronRight } from "lucide-react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type ColumnDef,
  type FilterFn,
  useReactTable,
} from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export interface RecordTableLabels {
  filter: string;
  showing: string;
  of: string;
  previousPage: string;
  nextPage: string;
  noResults: string;
}

interface RecordTableProps<TData> {
  data: TData[];
  columns: ColumnDef<TData, unknown>[];
  labels: RecordTableLabels;
  searchText: (row: TData) => string;
  filter?: string;
  onFilterChange?: (filter: string) => void;
  getRowId: (row: TData) => string;
  getRowLabel: (row: TData) => string;
  onRowClick: (row: TData) => void;
  pageSize?: number;
}

export function RecordTable<TData>({
  data,
  columns,
  labels,
  searchText,
  filter,
  onFilterChange,
  getRowId,
  getRowLabel,
  onRowClick,
  pageSize = 50,
}: RecordTableProps<TData>) {
  const [localFilter, setLocalFilter] = useState("");
  const globalFilter = filter ?? localFilter;
  const globalFilterFn: FilterFn<TData> = (row, _columnId, filterValue) =>
    searchText(row.original).toLocaleLowerCase().includes(String(filterValue).trim().toLocaleLowerCase());
  // TanStack manages mutable table handlers internally; React Compiler intentionally skips memoizing it.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    getRowId: row => getRowId(row),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn,
    state: { globalFilter },
    initialState: { pagination: { pageSize } },
  });
  const filteredCount = table.getPrePaginationRowModel().rows.length;
  const page = table.getState().pagination;
  const pageStart = filteredCount ? page.pageIndex * page.pageSize + 1 : 0;
  const pageEnd = Math.min(filteredCount, (page.pageIndex + 1) * page.pageSize);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <input
          value={globalFilter}
          onChange={event => {
            if (filter === undefined) setLocalFilter(event.target.value);
            onFilterChange?.(event.target.value);
            table.setPageIndex(0);
          }}
          placeholder={labels.filter}
          aria-label={labels.filter}
          className="h-9 min-w-56 rounded-lg border px-3 text-xs"
        />
        <span className="text-xs text-muted-foreground">{filteredCount} / {data.length}</span>
      </div>
      <div className="cyber-table max-h-[64vh] overflow-auto rounded-lg border">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card">
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map(header => {
                  const sorted = header.column.getIsSorted();
                  return (
                    <TableHead key={header.id} aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none"}>
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-left hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sorted === "asc" ? <ArrowUp className="h-3 w-3" /> : sorted === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowDownUp className="h-3 w-3 text-muted-foreground" />}
                        </button>
                      ) : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? table.getRowModel().rows.map(row => (
              <TableRow
                key={row.id}
                tabIndex={0}
                title={getRowLabel(row.original)}
                className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                onClick={() => onRowClick(row.original)}
                onKeyDown={event => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onRowClick(row.original);
                  }
                }}
              >
                {row.getVisibleCells().map(cell => (
                  <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                ))}
              </TableRow>
            )) : (
              <TableRow><TableCell colSpan={columns.length} className="py-8 text-center text-muted-foreground">{labels.noResults}</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {filteredCount > page.pageSize ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{labels.showing} {pageStart}-{pageEnd} {labels.of} {filteredCount}</span>
          <div className="flex gap-2">
            <Button type="button" size="icon" variant="outline" title={labels.previousPage} aria-label={labels.previousPage} disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}><ChevronLeft className="h-4 w-4" /></Button>
            <Button type="button" size="icon" variant="outline" title={labels.nextPage} aria-label={labels.nextPage} disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
