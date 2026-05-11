import { useEffect, useMemo, useState, type FormEvent } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowRight, Wand2 } from "lucide-react"
import { fetchDashboards, fetchDatasets, fetchPreview, createChart } from "@/lib/api"
import { useAppStore } from "@/stores/use-app-store"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ChartRenderer } from "@/components/chart-renderer"
import { chartTypeSchema, aggregationSchema, type FilterOperator, type QueryConfig } from "@shared/index"

function buildQuery(
  draft: ReturnType<typeof useAppStore.getState>["draft"],
  datasetId: string,
): QueryConfig {
  return {
    datasetId,
    dimensions: draft.dimension ? [draft.dimension] : [],
    metrics: [
      {
        column: draft.metric,
        aggregation: draft.aggregation,
        alias: `${draft.aggregation}_${draft.metric}`.replace(/[^a-zA-Z0-9_]/g, "_"),
      },
    ],
    filters: draft.filterValue.trim().length
      ? [
          {
            column: draft.filterColumn,
            operator: draft.filterOperator,
            value: draft.filterValue.trim(),
          },
        ]
      : [],
    limit: draft.limit,
  }
}

function datasetColumnOptions(dataset?: Awaited<ReturnType<typeof fetchDatasets>>[number]) {
  return {
    dimensions: dataset?.columns.filter((column) => column.type === "string" || column.type === "date") ?? [],
    metrics: dataset?.columns.filter((column) => column.type === "number") ?? [],
    filters: dataset?.columns ?? [],
  }
}

export function BuilderPage() {
  const queryClient = useQueryClient()
  const role = useAppStore((state) => state.role)
  const activeDatasetId = useAppStore((state) => state.activeDatasetId)
  const activeDashboardId = useAppStore((state) => state.activeDashboardId)
  const draft = useAppStore((state) => state.draft)
  const setActiveDatasetId = useAppStore((state) => state.setActiveDatasetId)
  const setActiveDashboardId = useAppStore((state) => state.setActiveDashboardId)
  const setDraft = useAppStore((state) => state.setDraft)
  const setDraftFromDataset = useAppStore((state) => state.setDraftFromDataset)

  const datasetsQuery = useQuery({
    queryKey: ["datasets"],
    queryFn: fetchDatasets,
  })
  const dashboardsQuery = useQuery({
    queryKey: ["dashboards"],
    queryFn: fetchDashboards,
  })

  useEffect(() => {
    const firstDataset = datasetsQuery.data?.[0]
    if (!activeDatasetId && firstDataset) {
      setActiveDatasetId(firstDataset.id)
      setDraftFromDataset(firstDataset)
    }
  }, [activeDatasetId, datasetsQuery.data, setActiveDatasetId, setDraftFromDataset])

  useEffect(() => {
    const firstDashboard = dashboardsQuery.data?.[0]
    if (!activeDashboardId && firstDashboard) {
      setActiveDashboardId(firstDashboard.id)
    }
  }, [activeDashboardId, dashboardsQuery.data, setActiveDashboardId])

  const activeDataset =
    datasetsQuery.data?.find((dataset) => dataset.id === activeDatasetId) ??
    datasetsQuery.data?.[0]
  const activeDashboard =
    dashboardsQuery.data?.find((dashboard) => dashboard.id === activeDashboardId) ??
    dashboardsQuery.data?.[0]

  const columns = useMemo(() => datasetColumnOptions(activeDataset), [activeDataset])
  const queryConfig = useMemo(
    () => (activeDataset ? buildQuery(draft, activeDataset.id) : null),
    [activeDataset, draft],
  )

  const previewMutation = useMutation({
    mutationFn: fetchPreview,
  })

  const createChartMutation = useMutation({
    mutationFn: createChart,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["dashboards"] })
    },
  })

  const [previewConfig, setPreviewConfig] = useState<QueryConfig | null>(null)
  const preview = previewMutation.data

  const previewMatchesCurrentQuery =
    !!queryConfig && !!previewConfig && JSON.stringify(queryConfig) === JSON.stringify(previewConfig)

  const previewHandler = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!queryConfig) {
      return
    }

    setPreviewConfig(queryConfig)
    previewMutation.mutate(queryConfig)
  }

  const saveChart = async () => {
    if (!activeDataset || !activeDashboard || !queryConfig || !preview || !previewMatchesCurrentQuery) {
      return
    }

    await createChartMutation.mutateAsync({
      dashboardId: activeDashboard.id,
      datasetId: activeDataset.id,
      title: draft.chartTitle,
      chartType: draft.chartType,
      query: queryConfig,
      position: {
        order: 0,
        x: 0,
        y: 0,
        width: draft.chartType === "table" ? 8 : 6,
        height: draft.chartType === "table" ? 5 : 4,
      },
      role,
      ownerSessionId: useAppStore.getState().ownerSessionId,
    })
  }

  return (
    <div className="grid gap-6">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_340px]">
        <Card className="overflow-hidden border-border/70 bg-card/85 shadow-sm backdrop-blur">
          <div className="bg-gradient-to-br from-chart-1/10 via-transparent to-accent/15">
            <CardHeader className="space-y-3">
              <Badge variant="secondary" className="w-fit">
                Query Builder
              </Badge>
              <CardTitle className="text-3xl">Build a query without writing SQL</CardTitle>
              <CardDescription className="max-w-2xl text-base">
                This page owns the structured query model, filters, and preview execution.
              </CardDescription>
            </CardHeader>
          </div>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <InfoCard title="Dataset" value={activeDataset?.name ?? "None"} />
            <InfoCard title="Role" value={role} description="Simulated access control" />
            <InfoCard title="Preview" value={preview?.rowCount?.toString() ?? "0"} description="Grouped rows" />
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/85 shadow-sm backdrop-blur">
          <CardHeader>
            <CardTitle className="text-lg">What this page owns</CardTitle>
            <CardDescription>
              Dimensions, metrics, filters, and preview results only.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm text-muted-foreground">
            <div className="rounded-2xl border border-border/60 bg-background/70 p-3">
              Pick a dimension and a metric.
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/70 p-3">
              Apply a filter and preview the grouped result.
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/70 p-3">
              Save the chart only after preview matches the current configuration.
            </div>
          </CardContent>
        </Card>
      </section>

      <ResizablePanelGroup direction="horizontal" className="min-h-[720px] gap-6">
        <ResizablePanel defaultSize={45} minSize={34}>
          <Card className="h-full border-border/70 bg-card/85 shadow-sm backdrop-blur">
            <CardHeader>
              <CardTitle>Builder controls</CardTitle>
              <CardDescription>Choose dataset, axis, metric, and filters.</CardDescription>
            </CardHeader>
            <form onSubmit={previewHandler}>
              <CardContent className="grid gap-4">
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Dataset</span>
                  <Select
                    value={activeDataset?.id ?? ""}
                    onValueChange={(datasetId) => {
                      setActiveDatasetId(datasetId)
                      const dataset = datasetsQuery.data?.find((entry) => entry.id === datasetId)
                      if (dataset) {
                        setDraftFromDataset(dataset)
                        setPreviewConfig(null)
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose dataset" />
                    </SelectTrigger>
                    <SelectContent>
                      {datasetsQuery.data?.map((dataset) => (
                        <SelectItem key={dataset.id} value={dataset.id}>
                          {dataset.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>

                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Chart title</span>
                  <Input
                    value={draft.chartTitle}
                    onChange={(event) => setDraft({ chartTitle: event.target.value })}
                    placeholder="Revenue by Product"
                  />
                </label>

                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="grid gap-2 text-sm">
                    <span className="font-medium">Chart type</span>
                    <Select
                      value={draft.chartType}
                      onValueChange={(chartType) =>
                        setDraft({ chartType: chartTypeSchema.parse(chartType) })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {chartTypeSchema.options.map((chartType) => (
                          <SelectItem key={chartType} value={chartType}>
                            {chartType}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                  <label className="grid gap-2 text-sm">
                    <span className="font-medium">Aggregation</span>
                    <Select
                      value={draft.aggregation}
                      onValueChange={(aggregation) =>
                        setDraft({ aggregation: aggregationSchema.parse(aggregation) })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {aggregationSchema.options.map((aggregation) => (
                          <SelectItem key={aggregation} value={aggregation}>
                            {aggregation.toUpperCase()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="grid gap-2 text-sm">
                    <span className="font-medium">Dimension</span>
                    <Select
                      value={draft.dimension}
                      onValueChange={(dimension) => setDraft({ dimension })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {columns.dimensions.map((column) => (
                          <SelectItem key={column.name} value={column.name}>
                            {column.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                  <label className="grid gap-2 text-sm">
                    <span className="font-medium">Metric</span>
                    <Select value={draft.metric} onValueChange={(metric) => setDraft({ metric })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {columns.metrics.map((column) => (
                          <SelectItem key={column.name} value={column.name}>
                            {column.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="grid gap-2 text-sm">
                    <span className="font-medium">Filter column</span>
                    <Select
                      value={draft.filterColumn}
                      onValueChange={(filterColumn) => setDraft({ filterColumn })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {columns.filters.map((column) => (
                          <SelectItem key={column.name} value={column.name}>
                            {column.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                  <label className="grid gap-2 text-sm">
                    <span className="font-medium">Operator</span>
                    <Select
                      value={draft.filterOperator}
                      onValueChange={(filterOperator) =>
                        setDraft({ filterOperator: filterOperator as FilterOperator })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="contains">contains</SelectItem>
                        <SelectItem value="eq">equals</SelectItem>
                        <SelectItem value="neq">not equals</SelectItem>
                        <SelectItem value="gt">greater than</SelectItem>
                        <SelectItem value="gte">greater or equal</SelectItem>
                        <SelectItem value="lt">less than</SelectItem>
                        <SelectItem value="lte">less or equal</SelectItem>
                      </SelectContent>
                    </Select>
                  </label>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="grid gap-2 text-sm">
                    <span className="font-medium">Filter value</span>
                    <Input
                      value={draft.filterValue}
                      onChange={(event) => setDraft({ filterValue: event.target.value })}
                      placeholder="West"
                    />
                  </label>
                  <label className="grid gap-2 text-sm">
                    <span className="font-medium">Limit</span>
                    <Input
                      type="number"
                      min={1}
                      max={1000}
                      value={draft.limit}
                      onChange={(event) =>
                        setDraft({ limit: Math.max(1, Number(event.target.value || 1)) })
                      }
                    />
                  </label>
                </div>
              </CardContent>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 px-6 py-4">
                <p className="text-xs text-muted-foreground">
                  Queries are validated on the server before preview and save.
                </p>
                <div className="flex gap-2">
                  <Button type="submit" variant="outline" disabled={!queryConfig || previewMutation.isPending}>
                    <ArrowRight className="size-4" />
                    {previewMutation.isPending ? "Previewing..." : "Preview"}
                  </Button>
                  <Button
                    type="button"
                    disabled={
                      !activeDashboard ||
                      !preview ||
                      !previewMatchesCurrentQuery ||
                      createChartMutation.isPending
                    }
                    onClick={saveChart}
                  >
                    <Wand2 className="size-4" />
                    Save chart
                  </Button>
                </div>
              </div>
            </form>
          </Card>
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={55} minSize={40}>
          <Card className="h-full border-border/70 bg-card/85 shadow-sm backdrop-blur">
            <CardHeader>
              <CardTitle>Preview</CardTitle>
              <CardDescription>
                The result is rendered as both a chart and a table.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {previewMutation.isError ? (
                <Alert variant="destructive">
                  <AlertTitle>Preview failed</AlertTitle>
                  <AlertDescription>{(previewMutation.error as Error).message}</AlertDescription>
                </Alert>
              ) : null}

              {preview ? (
                <div className="grid gap-4">
                  <div className="rounded-3xl border border-border/60 bg-background/70 p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">Grouped output</p>
                        <p className="text-xs text-muted-foreground">
                          {preview.rowCount} rows · {preview.executionMs.toFixed(1)}ms
                        </p>
                      </div>
                      <Badge variant={preview.cached ? "secondary" : "outline"}>
                        {preview.cached ? "cached" : "fresh"}
                      </Badge>
                    </div>
                    <div className="h-[320px]">
                      <ChartRenderer
                        chartType={draft.chartType}
                        query={queryConfig ?? buildQuery(draft, activeDataset?.id ?? "")}
                        preview={preview}
                      />
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-3xl border border-border/60">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {preview.columns.map((column) => (
                            <TableHead key={column.key}>{column.label}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preview.rows.map((row, index) => (
                          <TableRow key={index}>
                            {preview.columns.map((column) => (
                              <TableCell key={column.key}>{String(row[column.key] ?? "")}</TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : (
                <div className="flex min-h-[28rem] items-center justify-center rounded-3xl border border-dashed border-border/60 bg-muted/20 text-sm text-muted-foreground">
                  Run a preview to render the chart and table output here.
                </div>
              )}
            </CardContent>
          </Card>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}

function InfoCard({
  title,
  value,
  description,
}: {
  title: string
  value: string
  description?: string
}) {
  return (
    <Card className="border-border/60 bg-background/70">
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        <p className="truncate text-2xl font-semibold tracking-tight">{value}</p>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </CardContent>
    </Card>
  )
}
