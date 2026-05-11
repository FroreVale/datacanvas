import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { fetchDashboards, fetchDatasets } from "@/lib/api"
import { useAppStore } from "@/stores/use-app-store"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { Chart } from "@shared/index"

type ChartRow = {
  id: string
  title: string
  chartType: string
  dashboardTitle: string
  datasetName: string
  updatedAt: string
  chart: Chart
}

export function ChartsPage() {
  const role = useAppStore((state) => state.role)
  const navigate = useNavigate()

  const dashboardsQuery = useQuery({
    queryKey: ["dashboards"],
    queryFn: fetchDashboards,
  })
  const datasetsQuery = useQuery({
    queryKey: ["datasets"],
    queryFn: fetchDatasets,
  })

  const charts = useMemo<ChartRow[]>(() => {
    const dashboards = dashboardsQuery.data ?? []
    const datasets = datasetsQuery.data ?? []
    const datasetMap = new Map(datasets.map((dataset) => [dataset.id, dataset.name]))

    return dashboards.flatMap((dashboard) =>
      dashboard.charts.map((chart) => ({
        id: chart.id,
        title: chart.title,
        chartType: chart.chartType,
        dashboardTitle: dashboard.title,
        datasetName: datasetMap.get(chart.datasetId) ?? "Unknown dataset",
        updatedAt: new Date(chart.updatedAt).toLocaleString(),
        chart,
      })),
    )
  }, [dashboardsQuery.data, datasetsQuery.data])

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <section className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Charts</h1>
          <p className="text-sm text-muted-foreground">All saved charts in one table.</p>
        </div>
        <Badge variant="outline" className="capitalize">
          {role}
        </Badge>
      </section>

      <section className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-border/60">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Dashboard</TableHead>
              <TableHead>Dataset</TableHead>
              <TableHead>Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {charts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  No charts saved yet.
                </TableCell>
              </TableRow>
            ) : (
              charts.map((chart) => (
                <TableRow
                  key={chart.id}
                  className="cursor-pointer"
                  onClick={() =>
                    navigate("/builder", {
                      state: {
                        chart: chart.chart,
                      },
                    })
                  }
                >
                  <TableCell className="font-medium">{chart.title}</TableCell>
                  <TableCell className="capitalize">{chart.chartType}</TableCell>
                  <TableCell>{chart.dashboardTitle}</TableCell>
                  <TableCell>{chart.datasetName}</TableCell>
                  <TableCell>{chart.updatedAt}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>
    </div>
  )
}
