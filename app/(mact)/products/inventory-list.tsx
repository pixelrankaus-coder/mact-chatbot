"use client";

import * as React from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import Link from "next/link";
import { ArrowUpDown, Package, MapPin } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { InventoryProduct } from "./page";

function StockBadge({ available, minReorder }: { available: number; minReorder: number }) {
  if (available === 0) {
    return <Badge variant="destructive">Out of stock</Badge>;
  }
  if (minReorder > 0 && available <= minReorder) {
    return <Badge variant="warning">Low stock</Badge>;
  }
  return <Badge variant="success">In stock</Badge>;
}

function LocationBreakdown({ locations }: { locations: InventoryProduct["stock_locations"] }) {
  if (!locations || locations.length === 0) return <span className="text-muted-foreground text-xs">No stock data</span>;

  return (
    <div className="space-y-1">
      {locations.map((loc, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="font-medium min-w-[120px]">{loc.location}</span>
          <span className="text-muted-foreground">
            {loc.on_hand} on hand / {loc.available} avail
            {loc.on_order > 0 && <span className="text-blue-600 ml-1">+{loc.on_order} ordered</span>}
            {loc.in_transit > 0 && <span className="text-amber-600 ml-1">+{loc.in_transit} in transit</span>}
          </span>
        </div>
      ))}
    </div>
  );
}

const columns: ColumnDef<InventoryProduct>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <Button variant="ghost" className="-ml-3" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Product <ArrowUpDown className="ml-1 h-3 w-3" />
      </Button>
    ),
    cell: ({ row }) => {
      const p = row.original;
      return (
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded border bg-muted flex items-center justify-center shrink-0">
            {p.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.image_url} alt={p.name} className="h-10 w-10 object-cover rounded" />
            ) : (
              <Package className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0">
            <Link href={`/products/${encodeURIComponent(p.sku)}`} className="font-medium truncate max-w-[280px] block hover:text-blue-600 hover:underline" onClick={(e) => e.stopPropagation()}>
              {p.name}
            </Link>
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: "sku",
    header: "SKU",
    cell: ({ row }) => (
      <span className="font-mono text-sm text-muted-foreground">{row.original.sku}</span>
    ),
  },
  {
    accessorKey: "category",
    header: "Category",
    cell: ({ row }) => (
      <span className="text-sm">{row.original.category || "—"}</span>
    ),
  },
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ row }) => {
      const type = row.original.type;
      return (
        <Badge variant="outline" className="text-xs font-normal">
          {type || "—"}
        </Badge>
      );
    },
  },
  {
    accessorKey: "stock_available",
    header: ({ column }) => (
      <Button variant="ghost" className="-ml-3" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Available <ArrowUpDown className="ml-1 h-3 w-3" />
      </Button>
    ),
    cell: ({ row }) => {
      const p = row.original;
      if (p.type !== "Stock") return <span className="text-muted-foreground text-sm">N/A</span>;
      return (
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm">{p.stock_available}</span>
          <StockBadge available={p.stock_available} minReorder={p.min_before_reorder} />
        </div>
      );
    },
    sortingFn: "basic",
  },
  {
    accessorKey: "stock_on_hand",
    header: ({ column }) => (
      <Button variant="ghost" className="-ml-3" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        On Hand <ArrowUpDown className="ml-1 h-3 w-3" />
      </Button>
    ),
    cell: ({ row }) => {
      const p = row.original;
      if (p.type !== "Stock") return <span className="text-muted-foreground text-sm">—</span>;
      return <span className="font-mono text-sm">{p.stock_on_hand}</span>;
    },
  },
  {
    accessorKey: "stock_on_order",
    header: "On Order",
    cell: ({ row }) => {
      const val = row.original.stock_on_order;
      if (!val) return <span className="text-muted-foreground text-sm">—</span>;
      return <span className="font-mono text-sm text-blue-600">{val}</span>;
    },
  },
  {
    accessorKey: "price_tier_1",
    header: ({ column }) => (
      <Button variant="ghost" className="-ml-3" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        RRP <ArrowUpDown className="ml-1 h-3 w-3" />
      </Button>
    ),
    cell: ({ row }) => {
      const price = row.original.price_tier_1;
      if (!price || price === 0) return <span className="text-muted-foreground text-sm">—</span>;
      return <span className="text-sm">${price.toFixed(2)}</span>;
    },
  },
  {
    accessorKey: "weight",
    header: "Weight",
    cell: ({ row }) => {
      const p = row.original;
      if (!p.weight) return <span className="text-muted-foreground text-sm">—</span>;
      return <span className="text-sm">{p.weight}{p.uom === "kg" ? " kg" : ` ${p.uom || ""}`}</span>;
    },
  },
];

export function InventoryList({ data }: { data: InventoryProduct[] }) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<string>("all");
  const [stockFilter, setStockFilter] = React.useState<string>("all");
  const [expandedRow, setExpandedRow] = React.useState<string | null>(null);

  // Apply type and stock filters
  const filteredData = React.useMemo(() => {
    let result = data;
    if (typeFilter !== "all") {
      result = result.filter((p) => p.type === typeFilter);
    }
    if (stockFilter === "in-stock") {
      result = result.filter((p) => p.stock_available > 0);
    } else if (stockFilter === "out-of-stock") {
      result = result.filter((p) => p.stock_available === 0 && p.type === "Stock");
    } else if (stockFilter === "low-stock") {
      result = result.filter(
        (p) => p.stock_available > 0 && p.min_before_reorder > 0 && p.stock_available <= p.min_before_reorder
      );
    } else if (stockFilter === "on-order") {
      result = result.filter((p) => p.stock_on_order > 0);
    }
    return result;
  }, [data, typeFilter, stockFilter]);

  const table = useReactTable({
    data: filteredData,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, _columnId, filterValue) => {
      const search = filterValue.toLowerCase();
      const name = (row.original.name || "").toLowerCase();
      const sku = (row.original.sku || "").toLowerCase();
      return name.includes(search) || sku.includes(search);
    },
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    initialState: { pagination: { pageSize: 50 } },
    state: { sorting, columnFilters, columnVisibility, globalFilter },
  });

  // Get unique types and categories for filters
  const types = React.useMemo(() => [...new Set(data.map((p) => p.type).filter(Boolean))], [data]);

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Input
          placeholder="Search products or SKU..."
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="max-w-xs"
        />
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {types.map((t) => (
              <SelectItem key={t} value={t!}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={stockFilter} onValueChange={setStockFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Stock" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stock</SelectItem>
            <SelectItem value="in-stock">In Stock</SelectItem>
            <SelectItem value="out-of-stock">Out of Stock</SelectItem>
            <SelectItem value="low-stock">Low Stock</SelectItem>
            <SelectItem value="on-order">On Order</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground ml-auto">
          {filteredData.length} products
        </span>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => {
                const isExpanded = expandedRow === row.original.cin7_id;
                const hasLocations = row.original.stock_locations.length > 0;
                return (
                  <React.Fragment key={row.id}>
                    <TableRow
                      className={`${hasLocations ? "cursor-pointer" : ""} ${isExpanded ? "bg-muted/50" : ""}`}
                      onClick={() => {
                        if (hasLocations) {
                          setExpandedRow(isExpanded ? null : row.original.cin7_id);
                        }
                      }}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                    {isExpanded && hasLocations && (
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableCell colSpan={columns.length} className="py-3 px-6">
                          <div className="text-xs font-medium text-muted-foreground mb-2">
                            Stock by Location
                          </div>
                          <LocationBreakdown locations={row.original.stock_locations} />
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No products found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
