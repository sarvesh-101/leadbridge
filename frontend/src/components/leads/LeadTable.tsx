"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import {
  ChevronDown, ChevronUp, ChevronsUpDown, MoreHorizontal,
  Calendar,
} from "lucide-react";
import { Pagination } from "../shared/Pagination";
import { EmptyState } from "../shared/EmptyState";

import { cn, formatDate, formatCurrency } from "../../lib/utils";
import { LeadStatusBadge } from "../shared/LeadStatusBadge";
import { CallingPulse, CallingWaveform } from "./CallingPulse";
import type { Lead, LeadStatus } from "../../types";

interface LeadTableProps {
  leads: Lead[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onLeadClick: (lead: Lead) => void;
  loading?: boolean;
  onSelectionChange?: (ids: string[]) => void;
}

export function LeadTable({
  leads,
  total,
  page,
  pageSize,
  onPageChange,
  onLeadClick,
  loading,
  onSelectionChange,
}: LeadTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState({});

  // Handle row selection changes and notify parent
  const handleRowSelectionChange = (updater: any) => {
    const newSelection = typeof updater === 'function' ? updater(rowSelection) : updater;
    setRowSelection(newSelection);
    if (onSelectionChange) {
      const ids = Object.keys(newSelection)
        .filter((id) => (newSelection as Record<string, boolean>)[id])
        .map((rowId) => leads[parseInt(rowId)]?.id)
        .filter(Boolean) as string[];
      onSelectionChange(ids);
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  const columns = useMemo<ColumnDef<Lead>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <input
            type="checkbox"
            checked={table.getIsAllRowsSelected()}
            onChange={table.getToggleAllRowsSelectedHandler()}
            className="rounded border-[#E4E7DF] bg-[#F1F3EE]"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
            className="rounded border-[#E4E7DF] bg-[#F1F3EE]"
          />
        ),
        size: 40,
      },
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => {
          const isCalling = row.original.status === "CALLING";
          return (
            <button
              onClick={() => onLeadClick(row.original)}
              className="flex items-center gap-2 text-left font-medium text-[#1E2B24] hover:text-[#1B4332] transition-colors"
            >
              {isCalling && <CallingPulse size="sm" />}
              {row.original.name}
            </button>
          );
        },
      },
      {
        accessorKey: "phone",
        header: "Phone",
        cell: ({ row }) => {
          const isCalling = row.original.status === "CALLING";
          return (
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-mono text-[#5C6B62]">{row.original.phone}</span>
              {isCalling && <CallingWaveform />}
            </div>
          );
        },
      },
      {
        accessorKey: "source",
        header: "Source",
        cell: ({ row }) => (
          <span className="text-[12px] px-2 py-0.5 rounded bg-[#F1F3EE] text-[#5C6B62] border border-[#E4E7DF]">
            {row.original.source}
          </span>
        ),
      },
      {
        accessorKey: "receivedAt",
        header: "Received",
        cell: ({ row }) => (
          <span className="text-[12px] text-[#5C6B62]">{formatDate(row.original.receivedAt)}</span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <LeadStatusBadge
            status={row.original.status as LeadStatus}
            pulse={row.original.status === "CALLING"}
          />
        ),
      },
      {
        accessorKey: "score",
        header: "Score",
        cell: ({ row }) => {
          const score = row.original.score || 0;
          const color = score >= 70 ? "bg-[#047857]" : score >= 40 ? "bg-[#B45309]" : "bg-[#5C6B62]";
          return (
            <div className="flex items-center gap-2">
              <div className="w-16 h-1.5 rounded-full bg-[#F1F3EE] overflow-hidden">
                <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${score}%` }} />
              </div>
              <span className="text-[12px] font-medium text-[#5C6B62] font-mono">{score}</span>
            </div>
          );
        },
      },
      {
        accessorKey: "budget",
        header: "Budget",
        cell: ({ row }) => (
          <span className="text-[13px] text-[#5C6B62]">{row.original.budget ? formatCurrency(row.original.budget) : "—"}</span>
        ),
      },
      {
        accessorKey: "booking",
        header: "Visit",
        cell: ({ row }) => {
          const booking = row.original.booking;
          if (!booking) return <span className="text-[13px] text-[#8A948C]">—</span>;
          return (
            <div className="flex items-center gap-1 text-[13px] text-[#5C6B62]">
              <Calendar className="w-3 h-3" />
              {formatDate(booking.visitDate)}, {booking.visitTime}
            </div>
          );
        },
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <button
            onClick={() => onLeadClick(row.original)}
            className="p-1.5 rounded-lg hover:bg-[#F1F3EE] transition-colors"
          >
            <MoreHorizontal className="w-4 h-4 text-[#5C6B62]" />
          </button>
        ),
        size: 40,
      },
    ],
    [onLeadClick]
  );

  const table = useReactTable({
    data: leads,
    columns,
    state: { sorting, rowSelection },
    onSortingChange: setSorting,
    onRowSelectionChange: handleRowSelectionChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (loading) {
    return (
      <div className="rounded-lg bg-[#FFFFFF] border border-[#E4E7DF] overflow-hidden">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-14 px-4 flex items-center border-b border-[#E4E7DF] last:border-b-0">
            <div className="h-4 w-24 bg-[#F1F3EE] rounded animate-pulse" />
            <div className="h-4 w-20 bg-[#F1F3EE] rounded animate-pulse ml-8" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg bg-[#FFFFFF] border border-[#E4E7DF]">
        <table className="w-full">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-[#E4E7DF]">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left caption"
                    style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                  >
                    {header.isPlaceholder ? null : (
                      <button
                        className="flex items-center gap-1 hover:text-[#1E2B24] transition-colors"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {{
                          asc: <ChevronUp className="w-3 h-3" />,
                          desc: <ChevronDown className="w-3 h-3" />,
                        }[header.column.getIsSorted() as string] ?? (
                          header.column.getCanSort() ? <ChevronsUpDown className="w-3 h-3 opacity-0 group-hover:opacity-100" /> : null
                        )}
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-[#E4E7DF]">
            {table.getRowModel().rows.map((row) => {
              const isCalling = row.original.status === "CALLING";
              return (
                <motion.tr
                  key={row.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={cn(
                    "h-14 transition-colors cursor-pointer relative",
                    isCalling
                      ? "bg-gradient-to-r from-[#1B4332]/10 to-transparent"
                      : "hover:bg-[#F1F3EE]",
                    row.getIsSelected() && "bg-[#1B4332]/5"
                  )}
                  onClick={() => onLeadClick(row.original)}
                >
                  {/* Calling pulse animated left border */}
                  {isCalling && (
                    <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#1B4332] animate-pulse-border" />
                  )}
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 whitespace-nowrap">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </motion.tr>
              );
            })}
            {leads.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-4">
                  <EmptyState
                    title="No leads found"
                    description="New leads will appear here when they come in. Try adjusting your filters."
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        total={total}
        pageSize={pageSize}
        onPageChange={onPageChange}
        loading={loading}
      />
    </div>
  );
}
