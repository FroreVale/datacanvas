import { Link, useLocation } from "react-router-dom"
import {
  BarChart3,
  Database,
  LayoutDashboard,
  Layers3,
  Settings2,
} from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { fetchDashboards, fetchDatasets } from "@/lib/api"
import { useAppStore } from "@/stores/use-app-store"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

const navItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Datasets", url: "/datasets", icon: Database },
  { title: "Query Builder", url: "/builder", icon: Layers3 },
  { title: "Charts", url: "/charts", icon: BarChart3 },
  { title: "Settings", url: "/settings", icon: Settings2 },
] as const

export function AppSidebar() {
  const location = useLocation()
  const role = useAppStore((state) => state.role)
  const activeDatasetId = useAppStore((state) => state.activeDatasetId)
  const activeDashboardId = useAppStore((state) => state.activeDashboardId)
  const datasetsQuery = useQuery({
    queryKey: ["datasets"],
    queryFn: fetchDatasets,
  })
  const dashboardsQuery = useQuery({
    queryKey: ["dashboards"],
    queryFn: fetchDashboards,
  })

  const activeDataset =
    datasetsQuery.data?.find((dataset) => dataset.id === activeDatasetId) ??
    datasetsQuery.data?.[0]
  const activeDashboard =
    dashboardsQuery.data?.find((dashboard) => dashboard.id === activeDashboardId) ??
    dashboardsQuery.data?.[0]

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="gap-3">
        <Link
          to="/dashboard"
          className="flex items-center gap-3 rounded-2xl border border-sidebar-border/70 bg-sidebar-accent/30 px-3 py-3 transition-colors hover:bg-sidebar-accent/40"
        >
          <div className="grid size-10 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
            <span className="text-sm font-semibold">DC</span>
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-sidebar-foreground">
              DataCanvas
            </p>
            <p className="truncate text-xs text-sidebar-foreground/70">
              CSV analytics workspace
            </p>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigate</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    tooltip={item.title}
                    isActive={location.pathname === item.url}
                  >
                    <Link to={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>Workspace snapshot</SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="grid gap-3 px-2 py-1 text-sm">
              <div className="rounded-xl border border-sidebar-border/70 bg-sidebar-accent/20 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sidebar-foreground/70">Role</span>
                  <Badge
                    variant="outline"
                    className="border-sidebar-border bg-sidebar-primary/10 text-sidebar-foreground capitalize"
                  >
                    {role}
                  </Badge>
                </div>
              </div>
              <div className="rounded-xl border border-sidebar-border/70 bg-sidebar-accent/20 p-3 text-xs text-sidebar-foreground/70">
                <p className="font-medium text-sidebar-foreground">Active dataset</p>
                <p className="mt-1 truncate">{activeDataset?.name ?? "No dataset selected"}</p>
                <Separator className="my-3 bg-sidebar-border/70" />
                <p className="font-medium text-sidebar-foreground">Active dashboard</p>
                <p className="mt-1 truncate">{activeDashboard?.title ?? "No dashboard selected"}</p>
              </div>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

    </Sidebar>
  )
}
