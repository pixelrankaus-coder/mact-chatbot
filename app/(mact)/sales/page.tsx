import { generateMeta } from "@/lib/utils";

import CalendarDateRangePicker from "@/components/custom-date-range-picker";
import {
  BalanceCard,
  TaxCard,
  IncomeCard,
  ExpenseCard,
  BestSellingProducts,
  TableOrderStatus,
  RevenueChart,
  MetricsProvider,
  DashboardSourceProvider,
  SourceToggle
} from "./components";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export async function generateMetadata() {
  return generateMeta({
    title: "Sales Admin Dashboard",
    description:
      "A modern and elegant responsive sales admin Dashboard. Easily manage, analyze, and report your sales data. Built with shadcn/ui, Tailwind CSS, Next.js.",
    canonical: "/sales"
  });
}

export default function Page() {
  return (
    <DashboardSourceProvider>
      <div className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold tracking-tight lg:text-2xl">Sales Dashboard</h1>
            <SourceToggle />
          </div>
          <div className="flex items-center space-x-2">
            <div className="grow">
              <CalendarDateRangePicker />
            </div>
            <Button>
              <Download />
              <span className="hidden lg:inline">Download</span>
            </Button>
          </div>
        </div>
        <div className="gap-4 space-y-4 md:grid md:grid-cols-2 lg:space-y-0 xl:grid-cols-8">
          <div className="md:col-span-4">
            <RevenueChart />
          </div>
          <div className="md:col-span-4">
            <MetricsProvider>
              <div className="col-span-2 grid grid-cols-1 gap-4 md:grid-cols-2">
                <BalanceCard />
                <IncomeCard />
                <ExpenseCard />
                <TaxCard />
              </div>
            </MetricsProvider>
          </div>
        </div>
        <div className="gap-4 space-y-4 lg:space-y-0 xl:grid xl:grid-cols-3">
          <div className="xl:col-span-1">
            <BestSellingProducts />
          </div>
          <div className="xl:col-span-2">
            <TableOrderStatus />
          </div>
        </div>
      </div>
    </DashboardSourceProvider>
  );
}
