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
  useReactTable
} from "@tanstack/react-table";
import { ArrowDownIcon, ArrowUpIcon, ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ExportButton } from "@/components/CardActionMenus";
import { useRecentOrders, useOrderStatus, type RecentOrder } from "@/hooks/use-dashboard-data";
import { useDashboardSource, type DashboardSource } from "./dashboard-source-provider";

type Order = {
  id: string;
  orderNumber: string;
  customerName: string;
  items: number;
  amount: number;
  status: string;
  statusLabel: string;
};

const columns: ColumnDef<Order>[] = [
  {
    accessorKey: "orderNumber",
    header: "Order #",
    size: 100
  },
  {
    accessorKey: "customerName",
    header: "Customer Name"
  },
  {
    accessorKey: "items",
    header: "Items",
    cell: ({ row }) => {
      const items = row.getValue("items") as number;
      return items > 0 ? `${items} Items` : "-";
    }
  },
  {
    accessorKey: "amount",
    header: "Amount",
    cell: ({ row }) => {
      const amount = row.getValue("amount") as number;
      return `$${amount.toLocaleString("en-AU", { minimumFractionDigits: 2 })}`;
    }
  },
  {
    accessorKey: "statusLabel",
    header: "Status",
    cell: ({ row }) => {
      const status = row.original.status?.toLowerCase() || "";
      const label = row.original.statusLabel || status;

      const statusMap: Record<string, "success" | "info" | "warning" | "destructive" | "default"> = {
        // Cin7 statuses
        completed: "success",
        shipped: "success",
        invoiced: "success",
        closed: "success",
        credited: "success",
        ordering: "info",
        ordered: "info",
        draft: "info",
        estimated: "info",
        estimating: "info",
        approved: "warning",
        picking: "warning",
        packed: "warning",
        backordered: "warning",
        invoicing: "warning",
        cancelled: "destructive",
        void: "destructive",
        voided: "destructive",
        // WooCommerce statuses
        processing: "warning",
        "on-hold": "warning",
        pending: "info",
        refunded: "destructive",
        failed: "destructive",
      };

      const statusClass = statusMap[status] ?? "default";

      return (
        <Badge variant={statusClass} className="capitalize">
          {label}
        </Badge>
      );
    }
  }
];

const sourceLabels: Record<DashboardSource, string> = {
  all: "Cin7 and WooCommerce",
  cin7: "Cin7",
  woocommerce: "WooCommerce",
};

export function TableOrderStatus() {
  const { source } = useDashboardSource();
  const { orders, loading: ordersLoading } = useRecentOrders(20, source);
  const { summary, loading: statusLoading } = useOrderStatus(source);

  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});

  // Transform API data to table format
  const tableData: Order[] = React.useMemo(() => {
    return orders.map((order: RecentOrder) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customer,
      items: order.items,
      amount: order.amount,
      status: order.status,
      statusLabel: order.statusLabel
    }));
  }, [orders]);

  const table = useReactTable({
    data: tableData,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection
    },
    initialState: {
      pagination: {
        pageSize: 6
      }
    }
  });

  // Get status counts from summary
  const getStatusData = (id: string) => {
    const item = summary.find((s) => s.id === id);
    return {
      count: item?.count ?? 0,
      change: item?.change ?? 0,
      percentage: item?.percentage ?? 0
    };
  };

  const newOrders = getStatusData("new");
  const inProgress = getStatusData("in_progress");
  const completed = getStatusData("completed");
  const cancelled = getStatusData("cancelled");

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Track Order Status</CardTitle>
        <CardDescription>Recent orders from {sourceLabels[source]} (last 30 days)</CardDescription>
        <CardAction>
          <ExportButton />
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {statusLoading ? (
            <>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-2 w-full" />
                </div>
              ))}
            </>
          ) : (
            <>
              <div className="space-y-2">
                <div className="font-display text-2xl lg:text-3xl">{newOrders.count}</div>
                <div className="flex gap-2">
                  <div className="text-muted-foreground text-sm">New Order</div>
                  <div className={`flex items-center gap-0.5 text-xs ${newOrders.change >= 0 ? "text-green-500" : "text-red-500"}`}>
                    {newOrders.change >= 0 ? <ArrowUpIcon className="size-3" /> : <ArrowDownIcon className="size-3" />}
                    {Math.abs(newOrders.change).toFixed(1)}%
                  </div>
                </div>
                <Progress
                  value={newOrders.percentage}
                  className="h-2 bg-blue-100 dark:bg-blue-950"
                  indicatorColor="bg-blue-400"
                />
              </div>
              <div className="space-y-2">
                <div className="font-display text-2xl lg:text-3xl">{inProgress.count}</div>
                <div className="flex gap-2">
                  <div className="text-muted-foreground text-sm">In Progress</div>
                  <div className={`flex items-center gap-0.5 text-xs ${inProgress.change >= 0 ? "text-green-500" : "text-red-500"}`}>
                    {inProgress.change >= 0 ? <ArrowUpIcon className="size-3" /> : <ArrowDownIcon className="size-3" />}
                    {Math.abs(inProgress.change).toFixed(1)}%
                  </div>
                </div>
                <Progress
                  value={inProgress.percentage}
                  className="h-2 bg-teal-100 dark:bg-teal-950"
                  indicatorColor="bg-teal-400"
                />
              </div>
              <div className="space-y-2">
                <div className="font-display text-2xl lg:text-3xl">{completed.count}</div>
                <div className="flex gap-2">
                  <div className="text-muted-foreground text-sm">Completed</div>
                  <div className={`flex items-center gap-0.5 text-xs ${completed.change >= 0 ? "text-green-500" : "text-red-500"}`}>
                    {completed.change >= 0 ? <ArrowUpIcon className="size-3" /> : <ArrowDownIcon className="size-3" />}
                    {Math.abs(completed.change).toFixed(1)}%
                  </div>
                </div>
                <Progress
                  value={completed.percentage}
                  className="h-2 bg-green-100 dark:bg-green-950"
                  indicatorColor="bg-green-400"
                />
              </div>
              <div className="space-y-2">
                <div className="font-display text-2xl lg:text-3xl">{cancelled.count}</div>
                <div className="flex gap-2">
                  <div className="text-muted-foreground text-sm">Cancelled</div>
                  <div className={`flex items-center gap-0.5 text-xs ${cancelled.change <= 0 ? "text-green-500" : "text-red-500"}`}>
                    {cancelled.change <= 0 ? <ArrowDownIcon className="size-3" /> : <ArrowUpIcon className="size-3" />}
                    {Math.abs(cancelled.change).toFixed(1)}%
                  </div>
                </div>
                <Progress
                  value={cancelled.percentage}
                  className="h-2 bg-orange-100 dark:bg-orange-950"
                  indicatorColor="bg-orange-400"
                />
              </div>
            </>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Filter by customer..."
              value={(table.getColumn("customerName")?.getFilterValue() as string) ?? ""}
              onChange={(event) =>
                table.getColumn("customerName")?.setFilterValue(event.target.value)
              }
              className="max-w-sm"
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="ml-auto">
                  Columns <ChevronDown />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {table
                  .getAllColumns()
                  .filter((column) => column.getCanHide())
                  .map((column) => {
                    return (
                      <DropdownMenuCheckboxItem
                        key={column.id}
                        className="capitalize"
                        checked={column.getIsVisible()}
                        onCheckedChange={(value) => column.toggleVisibility(!!value)}>
                        {column.id}
                      </DropdownMenuCheckboxItem>
                    );
                  })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      return (
                        <TableHead key={header.id}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </TableHead>
                      );
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {ordersLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      {columns.map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center">
                      No orders found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-end space-x-2">
            <div className="text-muted-foreground flex-1 text-sm">
              Showing {table.getRowModel().rows.length} of {tableData.length} orders
            </div>
            <div className="space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}>
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}>
                Next
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
