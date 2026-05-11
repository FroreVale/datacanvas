import type {
  DatasetSummary,
  QueryConfig,
  QueryPreviewResult,
  QueryValue,
  PreviewColumn,
} from "../../../../packages/shared/src/index.ts"

type RecordRow = Record<string, QueryValue>

function normalizeComparable(value: QueryValue) {
  if (typeof value === "string") {
    return value
  }

  if (typeof value === "boolean") {
    return value ? 1 : 0
  }

  return value ?? 0
}

function compareValues(
  actual: QueryValue,
  expected: QueryValue,
  operator: QueryConfig["filters"][number]["operator"],
) {
  switch (operator) {
    case "eq":
      return actual === expected
    case "neq":
      return actual !== expected
    case "gt":
      return Number(normalizeComparable(actual)) > Number(expected)
    case "gte":
      return Number(normalizeComparable(actual)) >= Number(expected)
    case "lt":
      return Number(normalizeComparable(actual)) < Number(expected)
    case "lte":
      return Number(normalizeComparable(actual)) <= Number(expected)
    case "contains":
      return String(actual ?? "")
        .toLowerCase()
        .includes(String(expected ?? "").toLowerCase())
    default:
      return false
  }
}

function applyFilters(rows: RecordRow[], filters: QueryConfig["filters"]) {
  if (filters.length === 0) {
    return rows
  }

  return rows.filter((row) =>
    filters.every((filter) =>
      compareValues(row[filter.column], filter.value, filter.operator),
    ),
  )
}

function metricKey(metricColumn: string, aggregation: string, alias?: string) {
  return alias || `${aggregation}_${metricColumn}`.replace(/[^a-zA-Z0-9_]/g, "_")
}

function toNumber(value: QueryValue) {
  const num = Number(value)

  return Number.isFinite(num) ? num : 0
}

function aggregateRows(rows: RecordRow[], metric: QueryConfig["metrics"][number]) {
  switch (metric.aggregation) {
    case "sum":
      return rows.reduce((sum, row) => sum + toNumber(row[metric.column]), 0)
    case "avg": {
      const total = rows.reduce((sum, row) => sum + toNumber(row[metric.column]), 0)
      return rows.length > 0 ? total / rows.length : 0
    }
    case "count":
      return rows.length
    case "min":
      if (rows.length === 0) {
        return 0
      }
      return rows.reduce((min, row) => {
        const value = toNumber(row[metric.column])
        return value < min ? value : min
      }, Number.POSITIVE_INFINITY)
    case "max":
      if (rows.length === 0) {
        return 0
      }
      return rows.reduce((max, row) => {
        const value = toNumber(row[metric.column])
        return value > max ? value : max
      }, Number.NEGATIVE_INFINITY)
    default:
      return 0
  }
}

export function previewQuery(
  dataset: DatasetSummary,
  rows: RecordRow[],
  query: QueryConfig,
): QueryPreviewResult {
  const filteredRows = applyFilters(rows, query.filters)
  const dimensionKeys = query.dimensions

  const grouped = new Map<string, RecordRow[]>()

  if (dimensionKeys.length === 0) {
    grouped.set("__all__", filteredRows)
  } else {
    for (const row of filteredRows) {
      const key = dimensionKeys.map((dimension) => String(row[dimension] ?? "")).join("\u001f")
      const existing = grouped.get(key)
      if (existing) {
        existing.push(row)
      } else {
        grouped.set(key, [row])
      }
    }
  }

  const previewRows = Array.from(grouped.entries()).map(([groupKey, groupRows]) => {
    const row: RecordRow = {}

    if (groupKey === "__all__") {
      row.__all__ = "All rows"
    } else {
      const first = groupRows[0] ?? {}
      for (const dimension of dimensionKeys) {
        row[dimension] = first[dimension]
      }
    }

    for (const metric of query.metrics) {
      const key = metricKey(metric.column, metric.aggregation, metric.alias)
      row[key] = aggregateRows(groupRows, metric)
    }

    return row
  })

  const columns: PreviewColumn[] = [
    ...(dimensionKeys.length === 0
      ? [{ key: "__all__", label: "Group" }]
      : dimensionKeys.map((dimension) => ({
          key: dimension,
          label: dimension.charAt(0).toUpperCase() + dimension.slice(1),
        }))),
    ...query.metrics.map((metric) => ({
      key: metricKey(metric.column, metric.aggregation, metric.alias),
      label: metric.alias || `${metric.aggregation.toUpperCase()} ${metric.column}`,
    })),
  ]

  const limitedRows = typeof query.limit === "number" ? previewRows.slice(0, query.limit) : previewRows

  return {
    dataset,
    rowCount: limitedRows.length,
    rows: limitedRows,
    columns,
    generatedAt: new Date().toISOString(),
  }
}

export function buildMetricLabel(metric: QueryConfig["metrics"][number]) {
  return metric.alias || `${metric.aggregation.toUpperCase()} ${metric.column}`
}

export function buildMetricKey(metric: QueryConfig["metrics"][number]) {
  return metricKey(metric.column, metric.aggregation, metric.alias)
}
