import { useEffect, useMemo, useState, type FormEvent } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowRight,
  BarChart3,
  Filter,
  LineChart,
  PieChart,
  Plus,
  Table2,
  Wand2,
  X,
} from "lucide-react"
import { fetchDashboards, fetchDatasets, fetchPreview, createChart } from "@/lib/api"
import { useAppStore, type BuilderMetric } from "@/stores/use-app-store"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ChartRenderer } from "@/components/chart-renderer"
import {
  aggregationSchema,
  chartTypeSchema,
  type FilterOperator,
  type QueryConfig,
  type TableMode,
} from "@shared/index"
import {
  buildQueryConfig,
  COUNT_ROWS_METRIC,
  getChartRequirements,
  getDimensionOptions,
  getMetricOptions,
  getTableModeOptions,
  normalizeDraftForDataset,
} from "@/lib/chart-builder"

type FieldDialogKind = "dimension" | "metric" | "tableColumn" | null

function metricLabel(metric: BuilderMetric) {
  if (metric.column === COUNT_ROWS_METRIC) {
    return "COUNT rows"
  }

  return `${metric.aggregation.toUpperCase()} ${metric.column}`
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

  useEffect(() => {
    if (!activeDataset) {
      return
    }

    const normalized = normalizeDraftForDataset({
      chartType: draft.chartType,
      dataset: activeDataset,
      current: {
        tableMode: draft.tableMode,
        tableColumns: draft.tableColumns,
        dimensions: draft.dimensions,
        metrics: draft.metrics,
        filterColumn: draft.filterColumn,
      },
    })

    if (
      normalized.tableMode !== draft.tableMode ||
      JSON.stringify(normalized.tableColumns) !== JSON.stringify(draft.tableColumns) ||
      JSON.stringify(normalized.dimensions) !== JSON.stringify(draft.dimensions) ||
      JSON.stringify(normalized.metrics) !== JSON.stringify(draft.metrics) ||
      normalized.filterColumn !== draft.filterColumn
    ) {
      setDraft(normalized)
    }
  }, [activeDataset, draft, setDraft])

  const requirements = useMemo(
    () => getChartRequirements(draft.chartType, draft.tableMode),
    [draft.chartType, draft.tableMode],
  )
  const dimensionOptions = useMemo(
    () => getDimensionOptions(activeDataset, draft.chartType),
    [activeDataset, draft.chartType],
  )
  const metricOptions = useMemo(() => getMetricOptions(activeDataset), [activeDataset])
  const tableModeOptions = useMemo(() => getTableModeOptions(), [])
  const tableColumns = activeDataset?.columns ?? []
  const queryConfig = useMemo(
    () => (activeDataset ? buildQueryConfig(draft, activeDataset.id) : null),
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
  const [fieldDialog, setFieldDialog] = useState<FieldDialogKind>(null)
  const [filterDialogOpen, setFilterDialogOpen] = useState(false)
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [saveTitleDraft, setSaveTitleDraft] = useState(draft.chartTitle)
  const [newFieldColumn, setNewFieldColumn] = useState("")
  const [newFieldAggregation, setNewFieldAggregation] = useState<"sum" | "avg" | "count" | "min" | "max">("sum")
  const [filterColumnDraft, setFilterColumnDraft] = useState(draft.filterColumn)
  const [filterOperatorDraft, setFilterOperatorDraft] = useState<FilterOperator>(draft.filterOperator)
  const [filterValueDraft, setFilterValueDraft] = useState(draft.filterValue)
  const preview = previewMutation.data

  useEffect(() => {
    if (filterDialogOpen) {
      setFilterColumnDraft(draft.filterColumn)
      setFilterOperatorDraft(draft.filterOperator)
      setFilterValueDraft(draft.filterValue)
    }
  }, [draft.filterColumn, draft.filterOperator, draft.filterValue, filterDialogOpen])

  useEffect(() => {
    if (saveDialogOpen) {
      setSaveTitleDraft(draft.chartTitle || "Untitled chart")
    }
  }, [draft.chartTitle, saveDialogOpen])

  const previewMatchesCurrentQuery =
    !!queryConfig && !!previewConfig && JSON.stringify(queryConfig) === JSON.stringify(previewConfig)

  const isPreviewAllowed =
    !!activeDataset &&
    (draft.chartType === "table"
      ? draft.tableMode === "raw"
        ? draft.tableColumns.length > 0
        : draft.dimensions.length > 0 && draft.metrics.length > 0
      : draft.dimensions.length > 0 && draft.metrics.length > 0)

  const previewHandler = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!queryConfig || !isPreviewAllowed) {
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
      title: saveTitleDraft.trim() || "Untitled chart",
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

    setSaveDialogOpen(false)
  }

  const openFieldDialog = (kind: FieldDialogKind) => {
    if (kind === "metric") {
      const existing = draft.metrics[0]
      setNewFieldColumn(existing?.column === COUNT_ROWS_METRIC ? COUNT_ROWS_METRIC : existing?.column ?? "")
      setNewFieldAggregation(existing?.aggregation ?? "sum")
    } else if (kind === "dimension") {
      setNewFieldColumn(draft.dimensions[0] ?? "")
    } else if (kind === "tableColumn") {
      setNewFieldColumn(draft.tableColumns[0] ?? "")
    }
    setFieldDialog(kind)
  }

  const applyField = () => {
    if (fieldDialog === "dimension" && newFieldColumn) {
      if (!draft.dimensions.includes(newFieldColumn)) {
        setDraft({ dimensions: [...draft.dimensions, newFieldColumn] })
      }
    }

    if (fieldDialog === "metric" && newFieldColumn) {
      const nextMetric: BuilderMetric =
        newFieldAggregation === "count" && newFieldColumn === COUNT_ROWS_METRIC
          ? { column: COUNT_ROWS_METRIC, aggregation: "count" }
          : { column: newFieldColumn, aggregation: newFieldAggregation }
      if (!draft.metrics.some((metric) => metric.column === nextMetric.column && metric.aggregation === nextMetric.aggregation)) {
        setDraft({ metrics: [...draft.metrics, nextMetric] })
      }
    }

    if (fieldDialog === "tableColumn" && newFieldColumn) {
      if (!draft.tableColumns.includes(newFieldColumn)) {
        setDraft({ tableColumns: [...draft.tableColumns, newFieldColumn] })
      }
    }

    setFieldDialog(null)
    setNewFieldColumn("")
  }

  const removeDimension = (dimension: string) => {
    setDraft({ dimensions: draft.dimensions.filter((entry) => entry !== dimension) })
  }

  const removeMetric = (index: number) => {
    setDraft({ metrics: draft.metrics.filter((_, metricIndex) => metricIndex !== index) })
  }

  const removeTableColumn = (column: string) => {
    setDraft({ tableColumns: draft.tableColumns.filter((entry) => entry !== column) })
  }

  const applyFilter = () => {
    setDraft({
      filterColumn: filterColumnDraft,
      filterOperator: filterOperatorDraft,
      filterValue: filterValueDraft,
    })
    setFilterDialogOpen(false)
  }

  const chartTypeOptions = [
    { value: "bar" as const, label: "Bar chart", icon: BarChart3 },
    { value: "line" as const, label: "Line chart", icon: LineChart },
    { value: "pie" as const, label: "Pie chart", icon: PieChart },
    { value: "table" as const, label: "Table", icon: Table2 },
  ]

  return (
    <TooltipProvider>
      <div className="grid gap-4">
        <section className="grid gap-3 border-b border-border/60 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">Query Builder</h1>
                <Badge variant="secondary" className="capitalize">
                  {draft.chartType}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Build the query, preview the result, then save the chart.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="outline" className="capitalize">
                  {role}
                </Badge>
                <span>{preview?.rowCount?.toString() ?? "0"} rows</span>
              </div>
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
                <SelectTrigger className="w-[220px]">
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
            </div>
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,320px)_1px_minmax(0,1fr)]">
          <form onSubmit={previewHandler} className="grid gap-4">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <div className="text-sm font-medium">Visualization</div>
                <div className="flex flex-wrap gap-2">
                  {chartTypeOptions.map(({ value, label, icon: Icon }) => {
                    const active = draft.chartType === value
                    return (
                      <Tooltip key={value}>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant={active ? "secondary" : "outline"}
                            className="h-10 w-10 p-0"
                            onClick={() =>
                              setDraft({
                                chartType: value,
                                tableMode: value === "table" ? draft.tableMode : "raw",
                              })
                            }
                          >
                            <Icon className="size-4" />
                            <span className="sr-only">{label}</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{label}</TooltipContent>
                      </Tooltip>
                    )
                  })}
                </div>
              </div>

              {draft.chartType === "table" ? (
                <div className="grid gap-2">
                  <div className="text-sm font-medium">Table mode</div>
                  <div className="flex gap-2">
                    {tableModeOptions.map((option) => (
                      <Button
                        key={option.value}
                        type="button"
                        variant={draft.tableMode === option.value ? "secondary" : "outline"}
                        className="h-9"
                        onClick={() => setDraft({ tableMode: option.value })}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : null}

              {draft.chartType === "table" && draft.tableMode === "raw" ? (
                <div className="grid gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium">
                      Columns
                      {draft.tableColumns.length === 0 ? <span className="ml-1 text-destructive">*</span> : null}
                    </div>
                    <Button type="button" variant="outline" className="h-8 gap-2" onClick={() => openFieldDialog("tableColumn")}>
                      <Plus className="size-4" />
                      Add
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {draft.tableColumns.map((column) => (
                      <Badge key={column} variant="secondary" className="gap-1.5 rounded-full px-3 py-1">
                        {column}
                        <button type="button" onClick={() => removeTableColumn(column)} aria-label={`Remove ${column}`}>
                          <X className="size-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium">
                        Group by
                        {requirements.dimensionRequired ? <span className="ml-1 text-destructive">*</span> : null}
                      </div>
                      <Button type="button" variant="outline" className="h-8 gap-2" onClick={() => openFieldDialog("dimension")}>
                        <Plus className="size-4" />
                        Add
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {draft.dimensions.map((dimension) => (
                        <Badge key={dimension} variant="secondary" className="gap-1.5 rounded-full px-3 py-1">
                          {dimension}
                          <button type="button" onClick={() => removeDimension(dimension)} aria-label={`Remove ${dimension}`}>
                            <X className="size-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium">
                        Metrics
                        {requirements.metricRequired ? <span className="ml-1 text-destructive">*</span> : null}
                      </div>
                      <Button type="button" variant="outline" className="h-8 gap-2" onClick={() => openFieldDialog("metric")}>
                        <Plus className="size-4" />
                        Add
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {draft.metrics.map((metric, index) => (
                        <Badge key={`${metric.column}-${metric.aggregation}-${index}`} variant="secondary" className="gap-1.5 rounded-full px-3 py-1">
                          {metricLabel(metric)}
                          <button type="button" onClick={() => removeMetric(index)} aria-label={`Remove metric ${index}`}>
                            <X className="size-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>

                </div>
              )}

              {draft.chartType === "table" && draft.tableMode === "summary" ? (
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium">
                        Group by
                        {requirements.dimensionRequired ? <span className="ml-1 text-destructive">*</span> : null}
                      </div>
                      <Button type="button" variant="outline" className="h-8 gap-2" onClick={() => openFieldDialog("dimension")}>
                        <Plus className="size-4" />
                        Add
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {draft.dimensions.map((dimension) => (
                        <Badge key={dimension} variant="secondary" className="gap-1.5 rounded-full px-3 py-1">
                          {dimension}
                          <button type="button" onClick={() => removeDimension(dimension)} aria-label={`Remove ${dimension}`}>
                            <X className="size-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium">
                        Metrics
                        {requirements.metricRequired ? <span className="ml-1 text-destructive">*</span> : null}
                      </div>
                      <Button type="button" variant="outline" className="h-8 gap-2" onClick={() => openFieldDialog("metric")}>
                        <Plus className="size-4" />
                        Add
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {draft.metrics.map((metric, index) => (
                        <Badge key={`${metric.column}-${metric.aggregation}-${index}`} variant="secondary" className="gap-1.5 rounded-full px-3 py-1">
                          {metricLabel(metric)}
                          <button type="button" onClick={() => removeMetric(index)} aria-label={`Remove metric ${index}`}>
                            <X className="size-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium">Filters</div>
                  <Button type="button" variant="outline" className="h-8 gap-2" onClick={() => setFilterDialogOpen(true)}>
                    <Filter className="size-4" />
                    Add
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  {draft.filterValue.trim()
                    ? `${draft.filterColumn} ${draft.filterOperator} ${draft.filterValue}`
                    : "No filter applied."}
                </p>
              </div>

              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">Limit</span>
                <Input
                  type="number"
                  min={1}
                  max={1000}
                  value={draft.limit}
                  onChange={(event) => setDraft({ limit: Math.max(1, Number(event.target.value || 1)) })}
                />
              </label>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Button type="submit" variant="outline" disabled={!isPreviewAllowed || previewMutation.isPending}>
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
                  onClick={() => setSaveDialogOpen(true)}
                >
                  <Wand2 className="size-4" />
                  Save chart
                </Button>
              </div>
            </div>
          </form>

          <div className="hidden xl:block h-full w-px bg-border/70" />
          <div className="block xl:hidden h-px w-full bg-border/70" />

          <section className="grid gap-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold">Preview</h2>
              {preview ? <Badge variant={preview.cached ? "secondary" : "outline"}>{preview.cached ? "cached" : "fresh"}</Badge> : null}
            </div>

            {previewMutation.isError ? (
              <Alert variant="destructive">
                <AlertTitle>Preview failed</AlertTitle>
                <AlertDescription>{(previewMutation.error as Error).message}</AlertDescription>
              </Alert>
            ) : null}

            {preview ? (
              <div className="grid gap-4">
                <div>
                  <div className="mb-3 text-sm text-muted-foreground">
                    {preview.rowCount} rows · {preview.executionMs.toFixed(1)}ms
                  </div>
                  <div className="h-[320px]">
                    <ChartRenderer
                      chartType={draft.chartType}
                      query={queryConfig ?? buildQueryConfig(draft, activeDataset?.id ?? "")}
                      preview={preview}
                    />
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-border/70 bg-background/70">
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
              <div className="flex min-h-[28rem] items-center justify-center border border-dashed border-border/60 text-sm text-muted-foreground">
                Run a preview to render the chart and table output here.
              </div>
            )}
          </section>
        </div>

        <Dialog open={fieldDialog !== null} onOpenChange={(open) => !open && setFieldDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {fieldDialog === "metric"
                  ? "Add metric"
                  : fieldDialog === "dimension"
                    ? "Add group by"
                    : "Add column"}
              </DialogTitle>
              <DialogDescription>
                {fieldDialog === "metric"
                  ? "Pick a column and aggregation for the metric."
                  : fieldDialog === "dimension"
                    ? "Pick a column to group by."
                    : "Pick a column to show in the raw table."}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3">
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">Column</span>
                <Select value={newFieldColumn} onValueChange={setNewFieldColumn}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose column" />
                  </SelectTrigger>
                  <SelectContent>
                    {fieldDialog === "metric"
                      ? metricOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))
                      : fieldDialog === "tableColumn"
                        ? tableColumns.map((column) => (
                          <SelectItem key={column.name} value={column.name}>
                            {column.label}
                          </SelectItem>
                        ))
                        : dimensionOptions.map((column) => (
                          <SelectItem key={column.name} value={column.name}>
                            {column.label}
                          </SelectItem>
                        ))}
                  </SelectContent>
                </Select>
              </label>

              {fieldDialog === "metric" ? (
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Aggregation</span>
                  <Select
                    value={newFieldAggregation}
                    onValueChange={(value) =>
                      setNewFieldAggregation(value as "sum" | "avg" | "count" | "min" | "max")
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
              ) : null}

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setFieldDialog(null)}>
                  Cancel
                </Button>
                <Button type="button" onClick={applyField}>
                  Add
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={filterDialogOpen} onOpenChange={setFilterDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Filter</DialogTitle>
              <DialogDescription>Pick a column, operator, and value for the current query.</DialogDescription>
            </DialogHeader>

            <div className="grid gap-3">
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">Column</span>
                <Select value={filterColumnDraft} onValueChange={setFilterColumnDraft}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {tableColumns.map((column) => (
                      <SelectItem key={column.name} value={column.name}>
                        {column.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>

              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">Operator</span>
                <Select
                  value={filterOperatorDraft}
                  onValueChange={(value) => setFilterOperatorDraft(value as FilterOperator)}
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

              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">Value</span>
                <Input
                  value={filterValueDraft}
                  onChange={(event) => setFilterValueDraft(event.target.value)}
                  placeholder="West"
                />
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setFilterDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="button" onClick={applyFilter}>
                  Apply filter
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Save chart</DialogTitle>
              <DialogDescription>Name the chart before saving it to the dashboard.</DialogDescription>
            </DialogHeader>

            <div className="grid gap-3">
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">Chart title</span>
                <Input value={saveTitleDraft} onChange={(event) => setSaveTitleDraft(event.target.value)} />
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setSaveDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={
                    !activeDashboard ||
                    !preview ||
                    !previewMatchesCurrentQuery ||
                    createChartMutation.isPending ||
                    !saveTitleDraft.trim()
                  }
                  onClick={saveChart}
                >
                  Save
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}
