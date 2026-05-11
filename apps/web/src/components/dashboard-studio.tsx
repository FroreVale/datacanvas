import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import {
  createChart,
  deleteChart,
  fetchDataset,
  fetchDashboards,
  fetchDatasets,
  fetchPreview,
  updateDashboardLayout,
  uploadDataset,
} from "@/lib/api"
import { useAppStore } from "@/stores/use-app-store"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  aggregationSchema,
  chartTypeSchema,
  type Chart,
  type ChartType,
  type DatasetSummary,
  type QueryConfig,
  type QueryPreviewResult,
  type Role,
} from "@shared/index"

const chartColors = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(var(--chart-2, 220 70% 55%))",
  "hsl(var(--chart-3, 160 60% 45%))",
  "hsl(var(--chart-4, 280 60% 55%))",
]

function buildQuery(draft: ReturnType<typeof useAppStore.getState>["draft"], datasetId: string): QueryConfig {
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

function metricKey(query: QueryConfig) {
  const metric = query.metrics[0]
  if (!metric) {
    return "value"
  }

  return metric.alias || `${metric.aggregation}_${metric.column}`.replace(/[^a-zA-Z0-9_]/g, "_")
}

function chartDataKey(query: QueryConfig) {
  return metricKey(query)
}

function chartLabelKey(query: QueryConfig) {
  return query.dimensions[0] ?? "__all__"
}

function datasetColumnOptions(dataset?: DatasetSummary) {
  return {
    dimensions: dataset?.columns.filter((column) => column.type === "string" || column.type === "date") ?? [],
    metrics: dataset?.columns.filter((column) => column.type === "number") ?? [],
    filters: dataset?.columns ?? [],
  }
}

function isRoleDisabled(role: Role) {
  return role === "viewer"
}

function chartSizeClass(width: number) {
  if (width >= 8) return "xl:col-span-8"
  if (width >= 6) return "xl:col-span-6"
  if (width >= 4) return "xl:col-span-4"
  return "xl:col-span-3"
}

function heightClass(height: number) {
  if (height >= 6) return "min-h-[28rem]"
  if (height >= 4) return "min-h-[22rem]"
  return "min-h-[16rem]"
}

function ChartRenderer({
  chartType,
  query,
  preview,
}: {
  chartType: ChartType
  query: QueryConfig
  preview: QueryPreviewResult
}) {
  const labelKey = chartLabelKey(query)
  const dataKey = chartDataKey(query)

  if (preview.rows.length === 0) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No data matches the current query.</div>
  }

  if (chartType === "table") {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            {preview.columns.map((column) => (
              <TableHead key={column.key}>{column.label}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {preview.rows.slice(0, 8).map((row, index) => (
            <TableRow key={index}>
              {preview.columns.map((column) => (
                <TableCell key={column.key}>{String(row[column.key] ?? "")}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  }

  if (chartType === "pie") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip />
          <Pie
            data={preview.rows}
            dataKey={dataKey}
            nameKey={labelKey}
            innerRadius={60}
            outerRadius={100}
            paddingAngle={4}
          >
            {preview.rows.map((_, index) => (
              <Cell key={index} fill={chartColors[index % chartColors.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    )
  }

  if (chartType === "line") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={preview.rows}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={labelKey} tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} />
          <Tooltip />
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={preview.rows}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey={labelKey} tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} />
        <Tooltip />
        <Bar dataKey={dataKey} fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function ChartCard({
  chart,
  role,
  ownerSessionId,
  onMove,
  onResize,
  onDelete,
}: {
  chart: Chart
  role: Role
  ownerSessionId: string
  onMove: (chartId: string, delta: number) => void
  onResize: (chartId: string, delta: number) => void
  onDelete: (chartId: string) => void
}) {
  const queryClient = useQueryClient()
  const datasetQuery = useQuery({
    queryKey: ["dataset", chart.datasetId],
    queryFn: () => fetchDataset(chart.datasetId),
  })
  const previewQuery = useQuery({
    queryKey: ["chart-preview", chart.id, chart.version],
    queryFn: () => fetchPreview(chart.query),
    staleTime: 30_000,
  })

  const dataset = datasetQuery.data
  const preview = previewQuery.data
  const canEdit = role === "admin" || (role === "editor" && chart.ownerSessionId === ownerSessionId)
  const canDelete = canEdit

  useEffect(() => {
    if (dataset) {
      queryClient.setQueryData(["dataset", dataset.id], dataset)
    }
  }, [dataset, queryClient])

  return (
    <Card
      className={cn(
        "border-border/60 bg-card/80 shadow-sm backdrop-blur",
        chartSizeClass(chart.position.width),
        heightClass(chart.position.height),
      )}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="space-y-1">
          <CardTitle className="text-lg">{chart.title}</CardTitle>
          <CardDescription>
            {chart.chartType.toUpperCase()} chart - {dataset?.name ?? chart.datasetId}
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">v{chart.version}</Badge>
          <Badge variant="secondary">{chart.chartType}</Badge>
        </div>
      </CardHeader>
      <CardContent className="h-full min-h-0">
        {previewQuery.isLoading ? (
          <div className="flex h-full min-h-[12rem] items-center justify-center">
            <Skeleton className="h-8 w-32" />
          </div>
        ) : previewQuery.isError ? (
          <Alert variant="destructive">
            <AlertTitle>Chart preview failed</AlertTitle>
            <AlertDescription>{(previewQuery.error as Error).message}</AlertDescription>
          </Alert>
        ) : preview ? (
          <div className="h-full min-h-[12rem]">
            <ChartRenderer chartType={chart.chartType} query={chart.query} preview={preview} />
          </div>
        ) : null}
      </CardContent>
      <CardFooter className="flex items-center justify-between gap-2">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canEdit}
            onClick={() => onMove(chart.id, -1)}
          >
            Left
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canEdit}
            onClick={() => onMove(chart.id, 1)}
          >
            Right
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canEdit}
            onClick={() => onResize(chart.id, 1)}
          >
            Wider
          </Button>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!canDelete}
          onClick={() => onDelete(chart.id)}
        >
          Delete
        </Button>
      </CardFooter>
    </Card>
  )
}

export function DashboardStudio() {
  const queryClient = useQueryClient()
  const role = useAppStore((state) => state.role)
  const ownerSessionId = useAppStore((state) => state.ownerSessionId)
  const activeDashboardId = useAppStore((state) => state.activeDashboardId)
  const activeDatasetId = useAppStore((state) => state.activeDatasetId)
  const draft = useAppStore((state) => state.draft)
  const setRole = useAppStore((state) => state.setRole)
  const setActiveDashboardId = useAppStore((state) => state.setActiveDashboardId)
  const setActiveDatasetId = useAppStore((state) => state.setActiveDatasetId)
  const setDraft = useAppStore((state) => state.setDraft)
  const setDraftFromDataset = useAppStore((state) => state.setDraftFromDataset)

  const dashboardsQuery = useQuery({
    queryKey: ["dashboards"],
    queryFn: fetchDashboards,
  })

  const datasetsQuery = useQuery({
    queryKey: ["datasets"],
    queryFn: fetchDatasets,
  })

  useEffect(() => {
    const firstDashboard = dashboardsQuery.data?.[0]
    if (!activeDashboardId && firstDashboard) {
      setActiveDashboardId(firstDashboard.id)
    }
  }, [activeDashboardId, dashboardsQuery.data, setActiveDashboardId])

  useEffect(() => {
    const currentDataset =
      datasetsQuery.data?.find((dataset) => dataset.id === activeDatasetId) ?? datasetsQuery.data?.[0]
    if (currentDataset && currentDataset.id !== activeDatasetId) {
      setActiveDatasetId(currentDataset.id)
      setDraftFromDataset(currentDataset)
    }
  }, [activeDatasetId, datasetsQuery.data, setActiveDatasetId, setDraftFromDataset])

  const activeDashboard =
    dashboardsQuery.data?.find((dashboard) => dashboard.id === activeDashboardId) ??
    dashboardsQuery.data?.[0]
  const activeDataset =
    datasetsQuery.data?.find((dataset) => dataset.id === activeDatasetId) ??
    datasetsQuery.data?.[0]

  const columns = datasetColumnOptions(activeDataset)
  const queryPreviewMutation = useMutation({
    mutationFn: fetchPreview,
  })

  const uploadMutation = useMutation({
    mutationFn: uploadDataset,
    onSuccess: async (dataset) => {
      await queryClient.invalidateQueries({ queryKey: ["datasets"] })
      setActiveDatasetId(dataset.id)
      setDraftFromDataset(dataset)
    },
  })

  const createChartMutation = useMutation({
    mutationFn: createChart,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["dashboards"] })
    },
  })

  const deleteChartMutation = useMutation({
    mutationFn: deleteChart,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["dashboards"] })
    },
  })

  const layoutMutation = useMutation({
    mutationFn: updateDashboardLayout,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["dashboards"] })
    },
  })

  const [uploadFileName, setUploadFileName] = useState<string>("")
  const [uploadCsvText, setUploadCsvText] = useState<string>("")
  const [previewConfig, setPreviewConfig] = useState<QueryConfig | null>(null)

  const previewQuery = queryPreviewMutation.data
  const queryConfig = useMemo(
    () => (activeDataset ? buildQuery(draft, activeDataset.id) : null),
    [activeDataset, draft],
  )
  const previewMatchesCurrentQuery =
    !!queryConfig &&
    !!previewConfig &&
    JSON.stringify(queryConfig) === JSON.stringify(previewConfig)

  const previewHandler = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!queryConfig) {
      return
    }
    setPreviewConfig(queryConfig)
    queryPreviewMutation.mutate(queryConfig)
  }

  const saveChart = async () => {
    if (!activeDashboard || !activeDataset || !queryConfig || !previewQuery || !previewMatchesCurrentQuery) {
      return
    }

    await createChartMutation.mutateAsync({
      dashboardId: activeDashboard.id,
      datasetId: activeDataset.id,
      title: draft.chartTitle,
      chartType: draft.chartType,
      query: queryConfig,
      position: {
        order: activeDashboard.charts.length,
        width: draft.chartType === "table" ? 8 : 6,
        height: draft.chartType === "table" ? 5 : 4,
      },
      role,
      ownerSessionId,
    })
  }

  const moveChart = async (chartId: string, delta: number) => {
    if (!activeDashboard) {
      return
    }

    const nextItems = activeDashboard.charts.map((chart) => {
      if (chart.id === chartId) {
        return {
          chartId: chart.id,
          order: Math.max(0, chart.position.order + delta),
          width: chart.position.width,
          height: chart.position.height,
        }
      }

      return {
        chartId: chart.id,
        order: chart.position.order,
        width: chart.position.width,
        height: chart.position.height,
      }
    })

    await layoutMutation.mutateAsync({
      dashboardId: activeDashboard.id,
      expectedVersion: activeDashboard.version,
      role,
      items: nextItems,
    })
  }

  const resizeChart = async (chartId: string, delta: number) => {
    if (!activeDashboard) {
      return
    }

    const nextItems = activeDashboard.charts.map((chart) => {
      if (chart.id === chartId) {
        return {
          chartId: chart.id,
          order: chart.position.order,
          width: Math.min(12, Math.max(3, chart.position.width + delta)),
          height: chart.position.height,
        }
      }

      return {
        chartId: chart.id,
        order: chart.position.order,
        width: chart.position.width,
        height: chart.position.height,
      }
    })

    await layoutMutation.mutateAsync({
      dashboardId: activeDashboard.id,
      expectedVersion: activeDashboard.version,
      role,
      items: nextItems,
    })
  }

  const removeChart = async (chartId: string) => {
    await deleteChartMutation.mutateAsync({
      chartId,
      role,
      ownerSessionId,
    })
  }

  const handleCsvFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    setUploadFileName(file.name)
    setUploadCsvText(await file.text())
  }

  const canMutate = !isRoleDisabled(role)

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_420px]">
      <div className="grid gap-6">
        <Card className="border-border/60 bg-card/80 shadow-sm backdrop-blur">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="text-2xl">
                {activeDashboard?.title ?? "Dashboard"}
              </CardTitle>
              <CardDescription>
                {activeDashboard?.description ?? "Load a dashboard and start shaping queries."}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{role}</Badge>
              <Badge variant="outline">{datasetsQuery.data?.length ?? 0} datasets</Badge>
              <Badge variant="outline">{activeDashboard?.charts.length ?? 0} charts</Badge>
            </div>
          </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Active dataset</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-sm text-muted-foreground">
                {activeDataset?.name ?? "No dataset selected"}
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Current role</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-sm text-muted-foreground">
                {role === "viewer"
                  ? "Read-only"
                  : role === "editor"
                    ? "Can create and edit owned charts"
                    : "Full control"}
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Query cache</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-sm text-muted-foreground">
                Cached on the server by dataset version and query config.
              </CardContent>
            </Card>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-12">
          {activeDashboard?.charts.map((chart) => (
            <ChartCard
              key={chart.id}
              chart={chart}
              role={role}
              ownerSessionId={ownerSessionId}
              onMove={moveChart}
              onResize={resizeChart}
              onDelete={removeChart}
            />
          ))}
        </div>

        <Card className="border-border/60 bg-card/80 shadow-sm backdrop-blur">
          <CardHeader>
            <CardTitle>Upload CSV</CardTitle>
            <CardDescription>
              Upload a dataset to register metadata and generate new queryable columns.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <Input type="file" accept=".csv,text/csv" onChange={handleCsvFile} />
            <Button
              type="button"
              disabled={!canMutate || !uploadCsvText || uploadMutation.isPending}
              onClick={() =>
                uploadMutation.mutate({
                  filename: uploadFileName || "upload.csv",
                  csvText: uploadCsvText,
                  role,
                  ownerSessionId,
                })
              }
            >
              {uploadMutation.isPending ? "Uploading..." : "Upload dataset"}
            </Button>
          </CardContent>
          {uploadMutation.isError ? (
            <CardFooter>
              <Alert variant="destructive">
                <AlertTitle>Upload failed</AlertTitle>
                <AlertDescription>{(uploadMutation.error as Error).message}</AlertDescription>
              </Alert>
            </CardFooter>
          ) : null}
        </Card>
      </div>

      <div className="grid gap-6">
        <Card className="border-border/60 bg-card/80 shadow-sm backdrop-blur">
          <CardHeader>
            <CardTitle>Builder</CardTitle>
            <CardDescription>
              Select a dataset, shape the query, preview results, and save the chart.
            </CardDescription>
          </CardHeader>
          <form onSubmit={previewHandler}>
            <CardContent className="grid gap-4">
              <label className="grid gap-2 text-sm">
                <span className="font-medium">Role</span>
                <Select value={role} onValueChange={(nextRole) => setRole(nextRole as Role)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">admin</SelectItem>
                    <SelectItem value="editor">editor</SelectItem>
                    <SelectItem value="viewer">viewer</SelectItem>
                  </SelectContent>
                </Select>
              </label>

              <label className="grid gap-2 text-sm">
                <span className="font-medium">Dataset</span>
                <Select
                  value={activeDataset?.id ?? ""}
                  onValueChange={(datasetId) => {
                    setActiveDatasetId(datasetId)
                    const dataset = datasetsQuery.data?.find((entry) => entry.id === datasetId)
                    if (dataset) {
                      setDraftFromDataset(dataset)
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
                      setDraft({ filterOperator: filterOperator as typeof draft.filterOperator })
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
            <CardFooter className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Queries are validated on the server and executed against the uploaded CSV.
              </p>
              <div className="flex gap-2">
                <Button type="submit" variant="outline" disabled={!queryConfig || queryPreviewMutation.isPending}>
                  {queryPreviewMutation.isPending ? "Previewing..." : "Preview"}
                </Button>
                <Button
                  type="button"
                  disabled={!canMutate || !previewQuery || !previewMatchesCurrentQuery}
                  onClick={saveChart}
                >
                  Save chart
                </Button>
              </div>
            </CardFooter>
          </form>
        </Card>

        <Card className="border-border/60 bg-card/80 shadow-sm backdrop-blur">
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>Chart-ready output from the current builder configuration.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {queryPreviewMutation.isError ? (
              <Alert variant="destructive">
                <AlertTitle>Preview failed</AlertTitle>
                <AlertDescription>{(queryPreviewMutation.error as Error).message}</AlertDescription>
              </Alert>
            ) : null}

            {previewQuery ? (
              <div className="grid gap-3">
                <div className="rounded-xl border border-border/60 bg-background p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">Result</p>
                      <p className="text-xs text-muted-foreground">
                        {previewQuery.rowCount} grouped rows - {previewQuery.executionMs.toFixed(1)}ms
                      </p>
                    </div>
                    <Badge variant={previewQuery.cached ? "secondary" : "outline"}>
                      {previewQuery.cached ? "cached" : "fresh"}
                    </Badge>
                  </div>
                  <div className="h-[320px]">
                    <ChartRenderer
                      chartType={draft.chartType}
                      query={queryConfig ?? buildQuery(draft, activeDataset?.id ?? "")}
                      preview={previewQuery}
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-border/60">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {previewQuery.columns.map((column) => (
                          <TableHead key={column.key}>{column.label}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewQuery.rows.map((row, index) => (
                        <TableRow key={index}>
                          {previewQuery.columns.map((column) => (
                            <TableCell key={column.key}>{String(row[column.key] ?? "")}</TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[18rem] items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/20 text-sm text-muted-foreground">
                Preview a query to see chart-ready output here.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
