/**
 * Project Switcher
 *
 * Dropdown in the sidebar header for switching between projects.
 * Shows current project name + repo path, with a popover listing
 * all projects and a search filter.
 */

import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronsUpDown, FolderGit2, Plus, Search } from "lucide-react";
import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useTRPC } from "@/integrations/trpc/react";
import type { Project } from "@/lib/projects/types";

interface ProjectSwitcherProps {
  currentProjectId: string;
  currentProject: Project | null;
}

export function ProjectSwitcher({
  currentProjectId,
  currentProject,
}: ProjectSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { isMobile, setOpenMobile } = useSidebar();
  const navigate = useNavigate();
  const trpc = useTRPC();

  const projectsQuery = useQuery(trpc.projects.list.queryOptions());
  const projects = projectsQuery.data ?? [];

  const filtered = search
    ? projects.filter(
        (p) =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.repoPath.toLowerCase().includes(search.toLowerCase()),
      )
    : projects;

  const handleSelect = (project: Project) => {
    setOpen(false);
    setSearch("");
    if (isMobile) setOpenMobile(false);
    navigate({
      to: "/dashboard/p/$projectId",
      params: { projectId: project.id },
    });
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <SidebarMenuButton
              size="lg"
              tooltip={currentProject?.name ?? "Select project"}
            >
              <div className="size-8 rounded-lg bg-gradient-to-br from-git-muted to-git flex items-center justify-center text-white shrink-0">
                <FolderGit2 className="size-4" />
              </div>
              <div className="flex flex-col gap-0.5 leading-none min-w-0">
                <span className="font-semibold truncate">
                  {currentProject?.name ?? "Loading..."}
                </span>
                <span className="text-xs text-muted-foreground truncate">
                  {currentProject?.repoPath ?? ""}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4 shrink-0 opacity-50" />
            </SidebarMenuButton>
          </PopoverTrigger>
          <PopoverContent
            className="w-72 p-0"
            align="start"
            side={isMobile ? "bottom" : "right"}
          >
            {/* Search */}
            <div className="flex items-center gap-2 border-b px-3 py-2">
              <Search className="size-4 text-muted-foreground shrink-0" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search projects..."
                className="flex-1 bg-transparent text-base md:text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>

            {/* Project list */}
            <div className="max-h-64 overflow-y-auto p-1">
              {filtered.length === 0 ? (
                <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                  {search ? "No projects found" : "No projects yet"}
                </div>
              ) : (
                filtered.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => handleSelect(project)}
                    className={`w-full flex items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent ${
                      project.id === currentProjectId
                        ? "bg-accent text-accent-foreground"
                        : ""
                    }`}
                  >
                    <FolderGit2 className="size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <div className="font-medium truncate">{project.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {project.repoPath}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* New project action */}
            <div className="border-t p-1">
              <Link
                to="/dashboard/projects/new"
                onClick={() => {
                  setOpen(false);
                  if (isMobile) setOpenMobile(false);
                }}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <Plus className="size-4" />
                <span>New Project</span>
              </Link>
            </div>
          </PopoverContent>
        </Popover>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
