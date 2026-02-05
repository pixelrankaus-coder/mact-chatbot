import { promises as fs } from "fs";
import path from "path";
import { z } from "zod";

import { columns } from "@/app/dashboard/(auth)/apps/tasks/components/columns";
import { DataTable } from "@/app/dashboard/(auth)/apps/tasks/components/data-table";
import { taskSchema } from "@/app/dashboard/(auth)/apps/tasks/data/schema";

// Simulate a database read for tasks.
async function getTasks() {
  const data = await fs.readFile(
    path.join(process.cwd(), "app/dashboard/(auth)/apps/tasks/data/tasks.json")
  );

  const tasks = JSON.parse(data.toString());

  return z.array(taskSchema).parse(tasks);
}

export default async function TaskPage() {
  const tasks = await getTasks();

  return <DataTable data={tasks} columns={columns} />;
}
