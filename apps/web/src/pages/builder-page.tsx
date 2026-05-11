import { useEffect, useMemo, useState, type FormEvent } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowRight, Filter, Wand2 } from "lucide-react"
import { fetchDashboards, fetchDatasets, fetchPreview, createChart } from "@/lib/api"
import { useAppStore } from "@/stores/use-app-store"
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
        dimension: draft.dimension,
        metric: draft.metric,
        aggregation: draft.aggregation,
        filterColumn: draft.filterColumn,
      },
    })

    if (
      normalized.tableMode !== draft.tableMode ||
      JSON.stringify(normalized.tableColumns) !== JSON.stringify(draft.tableColumns) ||
      normalized.dimension !== draft.dimension ||
      normalized.metric !== draft.metric ||
      normalized.aggregation !== draft.aggregation ||
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
  const allColumns = activeDataset?.columns ?? []
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
  const [filterDialogOpen, setFilterDialogOpen] = useState(false)
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

  const previewMatchesCurrentQuery =
    !!queryConfig && !!previewConfig && JSON.stringify(queryConfig) === JSON.stringify(previewConfig)

  const isPreviewAllowed =
    !!activeDataset &&
    (draft.chartType === "table"
      ? draft.tableMode === "raw"
        ? draft.tableColumns.length > 0
        : draft.dimension.trim().length > 0 && draft.metric.trim().length > 0
      : draft.dimension.trim().length > 0 && draft.metric.trim().length > 0)

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

  const toggleTableColumn = (columnName: string) => {
    setDraft({
      tableColumns: draft.tableColumns.includes(columnName)
        ? draft.tableColumns.filter((column) => column !== columnName)
        : [...draft.tableColumns, columnName],
    })
  }

  const toggleGroupByColumn = (columnName: string) => {
    if (draft.chartType !== "table") {
      return
    }

    setDraft({
      dimension: draft.dimension === columnName ? "" : columnName,
    })
  }

  const applyFilter = () => {
    setDraft({
      filterColumn: filterColumnDraft,
      filterOperator: filterOperatorDraft,
      filterValue: filterValueDraft,
    })
    setFilterDialogOpen(false)
  }

  return (
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
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">{activeDataset?.name ?? "No dataset"}</Badge>
            <Badge variant="outline" className="capitalize">
              {role}
            </Badge>
            <span>{preview?.rowCount?.toString() ?? "0"} rows</span>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1.5 text-sm">
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

          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Chart title</span>
            <Input
              value={draft.chartTitle}
              onChange={(event) => setDraft({ chartTitle: event.target.value })}
              placeholder="Revenue by Product"
            />
          </label>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,320px)_1px_minmax(0,1fr)]">
        <form onSubmit={previewHandler} className="grid gap-4">
          <div className="grid gap-4">
            <label className="grid gap-1.5 text-sm">
              <span className="flex items-center gap-1 font-medium">
                Chart type
                <span className="text-destructive">*</span>
              </span>
              <Select
                value={draft.chartType}
                onValueChange={(chartType) => {
                  const nextChartType = chartTypeSchema.parse(chartType)
                  setDraft({
                    chartType: nextChartType,
                    tableMode: nextChartType === "table" ? draft.tableMode : "raw",
                  })
                }}
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

            {draft.chartType === "table" ? (
              <>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Table mode</span>
                  <Select
                    value={draft.tableMode}
                    onValueChange={(value) => setDraft({ tableMode: value as TableMode })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {tableModeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>

                {draft.tableMode === "raw" ? (
                  <div className="grid gap-2">
                    <div className="flex items-center gap-1 text-sm font-medium">
                      Columns
                      {draft.tableColumns.length === 0 ? <span className="text-destructive">*</span> : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {allColumns.map((column) => {
                        const selected = draft.tableColumns.includes(column.name)
                        return (
                          <Button
                            key={column.name}
                            type="button"
                            variant={selected ? "secondary" : "outline"}
                            className="h-8 px-3"
                            onClick={() => toggleTableColumn(column.name)}
                          >
                            {column.label}
                          </Button>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid gap-2">
                      <div className="flex items-center gap-1 text-sm font-medium">
                        Group by
                        {requirements.dimensionRequired ? (
                          <span className="text-destructive">*</span>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {getDimensionOptions(activeDataset, "bar").map((column) => {
                          const selected = draft.dimension === column.name
                          return (
                            <Button
                              key={column.name}
                              type="button"
                              variant={selected ? "secondary" : "outline"}
                              className="h-8 px-3"
                              onClick={() => toggleGroupByColumn(column.name)}
                            >
                              {column.label}
                            </Button>
                          )
                        })}
                      </div>
                    </div>

                    <label className="grid gap-1.5 text-sm">
                      <span className="flex items-center gap-1 font-medium">
                        Metric
                        <span className="text-destructive">*</span>
                      </span>
                      <Select
                        value={draft.metric}
                        onValueChange={(metric) =>
                          setDraft({
                            metric,
                            aggregation:
                              metric === COUNT_ROWS_METRIC
                                ? "count"
                                : draft.aggregation === "count"
                                  ? "sum"
                                  : draft.aggregation,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {metricOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </label>

                    <label className="grid gap-1.5 text-sm">
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
                  </>
                )}
              </>
            ) : (
              <>
                <label className="grid gap-1.5 text-sm">
                  <span className="flex items-center gap-1 font-medium">
                    {requirements.dimensionLabel}
                    <span className="text-destructive">*</span>
                  </span>
                  <Select
                    value={draft.dimension}
                    onValueChange={(dimension) => setDraft({ dimension })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {dimensionOptions.map((column) => (
                        <SelectItem key={column.name} value={column.name}>
                          {column.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>

                <label className="grid gap-1.5 text-sm">
                  <span className="flex items-center gap-1 font-medium">
                    {requirements.metricLabel}
                    <span className="text-destructive">*</span>
                  </span>
                  <Select
                    value={draft.metric}
                    onValueChange={(metric) =>
                      setDraft({
                        metric,
                        aggregation:
                          metric === COUNT_ROWS_METRIC
                            ? "count"
                            : draft.aggregation === "count"
                              ? "sum"
                              : draft.aggregation,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {metricOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>

                <label className="grid gap-1.5 text-sm">
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
              </>
            )}

            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-medium">Filters</div>
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 gap-2"
                  onClick={() => setFilterDialogOpen(true)}
                >
                  <Filter className="size-4" />
                  Edit filter
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
                onClick={saveChart}
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
            {preview ? (
              <Badge variant={preview.cached ? "secondary" : "outline"}>
                {preview.cached ? "cached" : "fresh"}
              </Badge>
            ) : null}
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
                  {allColumns.map((column) => (
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
    </div>
  )
}
