import {
  type Aggregation,
  type ChartType,
  type DatasetSummary,
  type QueryConfig,
  type TableMode,
} from "@shared/index"

export const COUNT_ROWS_METRIC = "__count_rows__"

type MetricDraft = {
  column: string
  aggregation: Aggregation
}

type ChartRequirements = {
  dimensionRequired: boolean
  metricRequired: boolean
  dimensionLabel: string
  metricLabel: string
  description: string
}

export function getChartRequirements(
  chartType: ChartType,
  tableMode: TableMode = "raw",
): ChartRequirements {
  switch (chartType) {
    case "line":
      return {
        dimensionRequired: true,
        metricRequired: true,
        dimensionLabel: "Group by",
        metricLabel: "Metrics",
        description: "Line charts work best with a time axis and one or more metrics.",
      }
    case "pie":
      return {
        dimensionRequired: true,
        metricRequired: true,
        dimensionLabel: "Category",
        metricLabel: "Metric",
        description: "Pie charts should keep one category and one aggregate.",
      }
    case "table":
      return {
        dimensionRequired: tableMode === "summary",
        metricRequired: tableMode === "summary",
        dimensionLabel: tableMode === "summary" ? "Group by" : "Columns",
        metricLabel: tableMode === "summary" ? "Metrics" : "Columns",
        description:
          tableMode === "summary"
            ? "Summary tables group rows and aggregate measures."
            : "Raw tables show selected columns with filters and limits.",
      }
    case "bar":
    default:
      return {
        dimensionRequired: true,
        metricRequired: true,
        dimensionLabel: "Group by",
        metricLabel: "Metrics",
        description: "Bar charts compare grouped categories against one or more metrics.",
      }
  }
}

export function getDimensionOptions(dataset?: DatasetSummary, chartType: ChartType = "bar") {
  const columns = dataset?.columns ?? []

  if (chartType === "table") {
    return columns
  }

  if (chartType === "line") {
    return [
      ...columns.filter((column) => column.type === "date"),
      ...columns.filter((column) => column.type === "string"),
      ...columns.filter((column) => column.type === "boolean"),
    ]
  }

  return [
    ...columns.filter((column) => column.type === "string"),
    ...columns.filter((column) => column.type === "date"),
    ...columns.filter((column) => column.type === "boolean"),
  ]
}

export function getMetricOptions(dataset?: DatasetSummary) {
  const columns = dataset?.columns ?? []
  return [
    {
      value: COUNT_ROWS_METRIC,
      label: "Count rows",
    },
    ...columns
      .filter((column) => column.type === "number")
      .map((column) => ({
        value: column.name,
        label: column.label,
      })),
  ]
}

export function getTableModeOptions() {
  return [
    { value: "raw" as const, label: "Raw rows" },
    { value: "summary" as const, label: "Aggregate" },
  ]
}

export function getDefaultTableMode(): TableMode {
  return "raw"
}

export function getDefaultDimension(dataset: DatasetSummary | undefined, chartType: ChartType) {
  const options = getDimensionOptions(dataset, chartType)
  return options[0]?.name ?? "product"
}

export function getDefaultDimensions(
  dataset: DatasetSummary | undefined,
  chartType: ChartType,
) {
  return [getDefaultDimension(dataset, chartType)]
}

export function getDefaultMetric(dataset: DatasetSummary | undefined) {
  const numeric = dataset?.columns.find((column) => column.type === "number")
  return numeric?.name ?? COUNT_ROWS_METRIC
}

export function getDefaultMetrics(dataset: DatasetSummary | undefined) {
  return [
    {
      column: getDefaultMetric(dataset),
      aggregation: getDefaultAggregation(getDefaultMetric(dataset)),
    },
  ]
}

export function getDefaultAggregation(metric: string): Aggregation {
  return metric === COUNT_ROWS_METRIC ? "count" : "sum"
}

export function getDefaultTableColumns(dataset: DatasetSummary | undefined) {
  return (dataset?.columns ?? []).slice(0, 3).map((column) => column.name)
}

function normalizeMetric(metric: MetricDraft) {
  const column = metric.column === COUNT_ROWS_METRIC ? "*" : metric.column
  const aggregation = metric.column === COUNT_ROWS_METRIC ? "count" : metric.aggregation
  return {
    column,
    aggregation,
    alias:
      aggregation === "count" && column === "*"
        ? "count_rows"
        : `${aggregation}_${column}`.replace(/[^a-zA-Z0-9_]/g, "_"),
  }
}

export function buildQueryConfig(
  draft: {
    chartType: ChartType
    tableMode: TableMode
    tableColumns: string[]
    dimensions: string[]
    metrics: MetricDraft[]
    filterColumn: string
    filterOperator: string
    filterValue: string
    limit: number
  },
  datasetId: string,
): QueryConfig {
  if (draft.chartType === "table" && draft.tableMode === "raw") {
    return {
      datasetId,
      chartType: draft.chartType,
      tableMode: draft.tableMode,
      tableColumns: draft.tableColumns,
      dimensions: [],
      metrics: [],
      filters: draft.filterValue.trim().length
        ? [
            {
              column: draft.filterColumn,
              operator: draft.filterOperator as
                | "eq"
                | "neq"
                | "gt"
                | "gte"
                | "lt"
                | "lte"
                | "contains",
              value: draft.filterValue.trim(),
            },
          ]
        : [],
      limit: draft.limit,
    }
  }

  return {
    datasetId,
    chartType: draft.chartType,
    tableMode: draft.chartType === "table" ? draft.tableMode : undefined,
    tableColumns: [],
    dimensions: draft.dimensions,
    metrics: draft.metrics.map(normalizeMetric),
    filters: draft.filterValue.trim().length
      ? [
          {
            column: draft.filterColumn,
            operator: draft.filterOperator as
              | "eq"
              | "neq"
              | "gt"
              | "gte"
              | "lt"
              | "lte"
              | "contains",
            value: draft.filterValue.trim(),
          },
        ]
      : [],
    limit: draft.limit,
  }
}

export function normalizeDraftForDataset(input: {
  chartType: ChartType
  dataset?: DatasetSummary
  current: {
    tableMode: TableMode
    tableColumns: string[]
    dimensions: string[]
    metrics: MetricDraft[]
    filterColumn: string
  }
}) {
  const { dataset, chartType, current } = input
  const columnMap = new Map((dataset?.columns ?? []).map((column) => [column.name, column]))
  const preferredDimensions = getDefaultDimensions(dataset, chartType)
  const preferredMetrics = getDefaultMetrics(dataset)
  const preferredTableColumns = getDefaultTableColumns(dataset)
  const dimensionOptions = getDimensionOptions(dataset, chartType)
  const metricOptions = getMetricOptions(dataset)

  const validDimensions = current.dimensions.filter((dimension) =>
    dimensionOptions.some((column) => column.name === dimension),
  )
  const validMetrics = current.metrics.filter((metric) =>
    metricOptions.some((option) => option.value === metric.column) || metric.column === COUNT_ROWS_METRIC,
  )
  const validTableColumns = current.tableColumns.filter((column) =>
    dataset?.columns.some((entry) => entry.name === column),
  )

  return {
    tableMode: chartType === "table" ? current.tableMode : getDefaultTableMode(),
    tableColumns:
      chartType === "table"
        ? validTableColumns.length > 0
          ? validTableColumns
          : preferredTableColumns
        : [],
    dimensions:
      chartType === "table" ? validDimensions : validDimensions.length > 0 ? validDimensions : preferredDimensions,
    metrics:
      chartType === "table"
        ? validMetrics.length > 0
          ? validMetrics
          : preferredMetrics
        : validMetrics.length > 0
          ? validMetrics
          : preferredMetrics,
    filterColumn:
      dataset?.columns.some((column) => column.name === current.filterColumn)
        ? current.filterColumn
        : dataset?.columns[0]?.name ?? current.filterColumn,
  } as const
}
