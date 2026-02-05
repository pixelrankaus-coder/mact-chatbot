"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus } from "lucide-react";
import Link from "next/link";

// Mock data for projects
const projects = [
  {
    id: 1,
    name: "Mobile App",
    category: "Prototyping",
    date: "May 01, 2021",
    progress: 78,
    progressColor: "bg-green-500",
    timeLeft: "1 week left",
    timeBadgeColor: "bg-orange-500",
    team: [
      { name: "Alex", initials: "AJ", avatar: null },
      { name: "Sarah", initials: "SC", avatar: null },
      { name: "Mike", initials: "MP", avatar: null },
    ],
  },
  {
    id: 2,
    name: "Design Learn Management System",
    category: "UI/UX Design",
    date: "June 04, 2021",
    progress: 32,
    progressColor: "bg-blue-500",
    timeLeft: "2 week left",
    timeBadgeColor: "bg-blue-500",
    team: [
      { name: "Emma", initials: "EW", avatar: null },
      { name: "Chris", initials: "CN", avatar: null },
    ],
  },
  {
    id: 3,
    name: "Chat Mobile App",
    category: "Prototyping",
    date: "Oct 27, 2021",
    progress: 89,
    progressColor: "bg-red-500",
    timeLeft: "3 days left",
    timeBadgeColor: "bg-red-500",
    team: [
      { name: "David", initials: "DK", avatar: null },
      { name: "Lisa", initials: "LB", avatar: null },
      { name: "Tom", initials: "TW", avatar: null },
      { name: "Anna", initials: "AS", avatar: null },
    ],
  },
  {
    id: 4,
    name: "NFT Marketplace App",
    category: "Prototyping",
    date: "Jan 03, 2021",
    progress: 69,
    progressColor: "bg-red-400",
    timeLeft: "4 week left",
    timeBadgeColor: "bg-green-500",
    team: [
      { name: "James", initials: "JR", avatar: null },
    ],
  },
  {
    id: 5,
    name: "E-commerce Platform",
    category: "Development",
    date: "May 09, 2021",
    progress: 56,
    progressColor: "bg-blue-500",
    timeLeft: "2 week left",
    timeBadgeColor: "bg-blue-500",
    team: [
      { name: "Maria", initials: "MG", avatar: null },
      { name: "John", initials: "JD", avatar: null },
      { name: "Kate", initials: "KP", avatar: null },
    ],
  },
  {
    id: 6,
    name: "LMS App Design",
    category: "UI/UX Design",
    date: "Jan 03, 2021",
    progress: 45,
    progressColor: "bg-orange-500",
    timeLeft: "5 week left",
    timeBadgeColor: "bg-slate-500",
    team: [
      { name: "Peter", initials: "PH", avatar: null },
      { name: "Nina", initials: "NR", avatar: null },
    ],
  },
  {
    id: 7,
    name: "Analytics Dashboard",
    category: "Development",
    date: "Feb 15, 2021",
    progress: 92,
    progressColor: "bg-green-500",
    timeLeft: "Done",
    timeBadgeColor: "bg-green-600",
    team: [
      { name: "Sam", initials: "SW", avatar: null },
      { name: "Olivia", initials: "OC", avatar: null },
    ],
  },
  {
    id: 8,
    name: "Healthcare Portal",
    category: "Prototyping",
    date: "Mar 20, 2021",
    progress: 25,
    progressColor: "bg-purple-500",
    timeLeft: "6 week left",
    timeBadgeColor: "bg-purple-500",
    team: [
      { name: "Ryan", initials: "RB", avatar: null },
      { name: "Sophie", initials: "SL", avatar: null },
      { name: "Leo", initials: "LM", avatar: null },
    ],
  },
];

export default function ProjectListPage() {
  return (
    <div className="flex-1 overflow-auto bg-slate-50">
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-white px-6 py-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Projects</h1>
          <p className="text-sm text-slate-500">
            List of your ongoing projects
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Project
        </Button>
      </div>

      <div className="p-6">
        {/* Project Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {projects.map((project) => (
            <Link href={`/projects/${project.id}`} key={project.id}>
              <Card className="h-full border-slate-200 shadow-sm transition-all hover:shadow-md hover:border-slate-300">
                <CardContent className="p-5">
                  {/* Project Info */}
                  <div className="mb-4">
                    <h3 className="font-semibold text-slate-900 line-clamp-1">
                      {project.name}
                    </h3>
                    <p className="text-sm text-slate-500">{project.category}</p>
                  </div>

                  {/* Date */}
                  <p className="mb-4 text-sm text-slate-400">{project.date}</p>

                  {/* Progress */}
                  <div className="mb-4">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-sm text-slate-500">Progress</span>
                      <span className="text-sm font-medium text-slate-700">
                        {project.progress}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${project.progressColor} transition-all`}
                        style={{ width: `${project.progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Footer: Team & Time Badge */}
                  <div className="flex items-center justify-between">
                    {/* Team Avatars */}
                    <div className="flex -space-x-2">
                      {project.team.slice(0, 4).map((member, idx) => (
                        <Avatar
                          key={idx}
                          className="h-8 w-8 border-2 border-white shadow-sm"
                        >
                          <AvatarImage src={member.avatar || undefined} />
                          <AvatarFallback className="bg-slate-200 text-xs font-medium text-slate-600">
                            {member.initials}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                      {project.team.length > 4 && (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-slate-100 text-xs font-medium text-slate-600">
                          +{project.team.length - 4}
                        </div>
                      )}
                    </div>

                    {/* Time Badge */}
                    <Badge
                      className={`${project.timeBadgeColor} border-0 text-white text-xs`}
                    >
                      {project.timeLeft}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
