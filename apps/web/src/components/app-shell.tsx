import { Link, Outlet, useLocation } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { ModeToggle } from "@/components/mode-toggle"
import { AppSidebar } from "@/components/app-sidebar"
import { useAppStore } from "@/stores/use-app-store"

const routeLabels: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/datasets": "Datasets",
  "/builder": "Query Builder",
  "/charts": "Charts",
  "/settings": "Settings",
}

function getRouteLabel(pathname: string) {
  if (pathname.startsWith("/builder")) {
    return "Query Builder"
  }

  return routeLabels[pathname] ?? "Dashboard"
}

export function AppShell() {
  const location = useLocation()
  const role = useAppStore((state) => state.role)

  return (
    <div className="flex h-screen min-h-0 overflow-hidden">
      <SidebarProvider defaultOpen style={{ "--sidebar-width": "15rem" } as any}>
        <AppSidebar />
        <SidebarInset className="h-full min-h-0 overflow-hidden bg-background">
          <header className="sticky top-0 z-20 border-b border-border/70 bg-background/80 backdrop-blur">
            <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
              <SidebarTrigger />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link to="/dashboard">DataCanvas</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>{getRouteLabel(location.pathname)}</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="h-7 rounded-full px-3 text-xs capitalize">
                  {role}
                </Badge>
                <ModeToggle />
              </div>
            </div>
          </header>

          <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden px-3 py-3 sm:px-4 lg:px-6">
              <Outlet />
            </div>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </div>
  )
}
