import {
  type Aggregation,
  type ChartType,
  type DatasetColumn,
  type DatasetSummary,
  type QueryConfig,
  type TableMode,
} from "@shared/index"

export const COUNT_ROWS_METRIC = "__count_rows__"

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
        dimensionLabel: "Date / time",
        metricLabel: "Metric",
        description: "Line charts work best with a time axis and one metric.",
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
        metricLabel: tableMode === "summary" ? "Metric" : "Metrics",
        description:
          tableMode === "summary"
            ? "Summary tables group rows and aggregate one or more measures."
            : "Raw tables show selected columns with filters and limits.",
      }
    case "bar":
    default:
      return {
        dimensionRequired: true,
        metricRequired: true,
        dimensionLabel: "Category",
        metricLabel: "Metric",
        description: "Bar charts compare categories against one aggregated measure.",
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
    { value: "summary" as const, label: "Summary" },
  ]
}

export function getDefaultTableMode(): TableMode {
  return "raw"
}

export function getDefaultDimension(
  dataset: DatasetSummary | undefined,
  chartType: ChartType,
) {
  const options = getDimensionOptions(dataset, chartType)
  return options[0]?.name ?? "product"
}

export function getDefaultMetric(dataset: DatasetSummary | undefined) {
  const numeric = dataset?.columns.find((column) => column.type === "number")
  return numeric?.name ?? COUNT_ROWS_METRIC
}

export function getDefaultAggregation(metric: string): Aggregation {
  return metric === COUNT_ROWS_METRIC ? "count" : "sum"
}

export function getDefaultTableColumns(dataset: DatasetSummary | undefined) {
  return (dataset?.columns ?? []).slice(0, 3).map((column) => column.name)
}

export function buildQueryConfig(
  draft: {
    chartType: ChartType
    tableMode: TableMode
    tableColumns: string[]
    dimension: string
    metric: string
    aggregation: Aggregation
    filterColumn: string
    filterOperator: string
    filterValue: string
    limit: number
  },
  datasetId: string,
): QueryConfig {
  const metricColumn = draft.metric === COUNT_ROWS_METRIC ? "*" : draft.metric
  const aggregation = draft.metric === COUNT_ROWS_METRIC ? "count" : draft.aggregation

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
              operator: draft.filterOperator as "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "contains",
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
    dimensions: draft.dimension ? [draft.dimension] : [],
    metrics:
      draft.chartType === "table" && draft.tableMode === "summary"
        ? [
            {
              column: metricColumn,
              aggregation,
              alias:
                aggregation === "count" && metricColumn === "*"
                  ? "count_rows"
                  : `${aggregation}_${metricColumn}`.replace(/[^a-zA-Z0-9_]/g, "_"),
            },
          ]
        : [
            {
              column: metricColumn,
              aggregation,
              alias:
                aggregation === "count" && metricColumn === "*"
                  ? "count_rows"
                  : `${aggregation}_${metricColumn}`.replace(/[^a-zA-Z0-9_]/g, "_"),
            },
          ],
    filters: draft.filterValue.trim().length
      ? [
          {
            column: draft.filterColumn,
            operator: draft.filterOperator as "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "contains",
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
    dimension: string
    metric: string
    aggregation: Aggregation
    filterColumn: string
  }
}) {
  const { dataset, chartType, current } = input
  const dimensionOptions = getDimensionOptions(dataset, chartType)
  const metricOptions = getMetricOptions(dataset)
  const columnMap = new Map((dataset?.columns ?? []).map((column) => [column.name, column]))

  const preferredDimension = getDefaultDimension(dataset, chartType)
  const preferredMetric = getDefaultMetric(dataset)
  const preferredAggregation = getDefaultAggregation(preferredMetric)
  const preferredTableColumns = getDefaultTableColumns(dataset)
  const validTableColumns = current.tableColumns.filter((column) =>
    dataset?.columns.some((entry) => entry.name === column),
  )

  const currentDimensionType = columnMap.get(current.dimension)?.type
  const dimensionExists = dimensionOptions.some((column) => column.name === current.dimension)
  const metricExists = metricOptions.some((option) => option.value === current.metric)
  const shouldPreferChartDimension =
      (chartType === "line" && currentDimensionType !== "date" && preferredDimension !== current.dimension) ||
      ((chartType === "bar" || chartType === "pie") &&
        currentDimensionType !== "string" &&
        preferredDimension !== current.dimension)

  return {
    tableMode:
      chartType === "table" ? current.tableMode : getDefaultTableMode(),
    tableColumns:
      chartType === "table"
        ? validTableColumns.length > 0
          ? validTableColumns
          : preferredTableColumns
        : [],
    dimension:
      dimensionExists && !shouldPreferChartDimension ? current.dimension : preferredDimension,
    metric: metricExists ? current.metric : preferredMetric,
    aggregation:
      current.metric === COUNT_ROWS_METRIC
        ? "count"
        : current.aggregation === "count"
          ? preferredAggregation
          : current.aggregation,
    filterColumn:
      dataset?.columns.some((column) => column.name === current.filterColumn)
        ? current.filterColumn
        : dataset?.columns[0]?.name ?? current.filterColumn,
  } as const
}
