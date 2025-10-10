import { generateMeta } from "@/lib/utils";
import { Metadata } from "next";

import EventCalendarApp from "./components/event-calendar-app";

export async function generateMetadata(): Promise<Metadata> {
  return generateMeta({
    title: "Calendar",
    description:
      "Plan your events or tasks in an organized way with the Calendar app template. Built with shadcn/ui, Next.js and Tailwind CSS.",
    canonical: "/apps/calendar"
  });
}

export default function Page() {
  return <EventCalendarApp />;
}
