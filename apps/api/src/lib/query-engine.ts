import { DuckDBConnection, DuckDBInstance } from "@duckdb/node-api"
import type {
  DatasetColumn,
  DatasetSummary,
  QueryConfig,
  QueryPreviewResult,
  QueryValue,
  PreviewColumn,
} from "../../../../packages/shared/src/index.ts"

type RecordRow = Record<string, QueryValue>

let duckdbInstancePromise: Promise<DuckDBInstance> | null = null

function getDuckDBInstance() {
  duckdbInstancePromise ??= DuckDBInstance.create(":memory:")
  return duckdbInstancePromise
}

function escapeIdentifier(identifier: string) {
  return `"${identifier.replace(/"/g, '""')}"`
}

function metricKey(metricColumn: string, aggregation: string, alias?: string) {
  return alias || `${aggregation}_${metricColumn}`.replace(/[^a-zA-Z0-9_]/g, "_")
}

function normalizeParameter(value: QueryValue): string | number | null {
  if (value === null) {
    return null
  }

  if (typeof value === "boolean") {
    return value ? 1 : 0
  }

  return value
}

function buildWhereClause(
  query: QueryConfig,
  columns: DatasetColumn[],
  parameters: Array<string | number | null>,
) {
  const clauses: string[] = []
  const columnMap = new Map(columns.map((column) => [column.name, column]))

  for (const filter of query.filters) {
    const column = columnMap.get(filter.column)
    if (!column) {
      throw new Error(`Unknown filter column: ${filter.column}`)
    }

    const escapedColumn = escapeIdentifier(filter.column)

    switch (filter.operator) {
      case "eq":
        clauses.push(`${escapedColumn} = ?`)
        parameters.push(normalizeParameter(filter.value))
        break
      case "neq":
        clauses.push(`${escapedColumn} != ?`)
        parameters.push(normalizeParameter(filter.value))
        break
      case "gt":
      case "gte":
      case "lt":
      case "lte": {
        const comparator =
          filter.operator === "gt"
            ? ">"
            : filter.operator === "gte"
              ? ">="
              : filter.operator === "lt"
                ? "<"
                : "<="

        clauses.push(`${escapedColumn} ${comparator} ?`)
        parameters.push(normalizeParameter(filter.value))
        break
      }
      case "contains":
        clauses.push(`LOWER(CAST(${escapedColumn} AS VARCHAR)) LIKE LOWER(?)`)
        parameters.push(`%${String(filter.value ?? "")}%`)
        break
      default:
        throw new Error(`Unsupported filter operator: ${filter.operator}`)
    }

    if (column.type === "number" && typeof filter.value === "string") {
      const numeric = Number(filter.value)
      if (Number.isFinite(numeric)) {
        parameters[parameters.length - 1] = numeric
      }
    }
  }

  return clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : ""
}

function buildSelectClause(query: QueryConfig) {
  const dimensions = query.dimensions.map((dimension) => escapeIdentifier(dimension))
  const metricSelects = query.metrics.map((metric) => {
    const alias = metricKey(metric.column, metric.aggregation, metric.alias)

    switch (metric.aggregation) {
      case "count":
        return `COUNT(*) AS ${escapeIdentifier(alias)}`
      case "sum":
      case "avg":
      case "min":
      case "max":
        return `${metric.aggregation.toUpperCase()}(CAST(${escapeIdentifier(metric.column)} AS DOUBLE)) AS ${escapeIdentifier(alias)}`
      default:
        return `COUNT(*) AS ${escapeIdentifier(alias)}`
    }
  })

  const selection = [...dimensions, ...metricSelects]
  if (selection.length === 0) {
    return "SELECT *"
  }

  return `SELECT ${selection.join(", ")}`
}

function buildGroupByClause(query: QueryConfig) {
  if (query.dimensions.length === 0) {
    return ""
  }

  return `GROUP BY ${query.dimensions.map(escapeIdentifier).join(", ")}`
}

function buildOrderByClause(query: QueryConfig) {
  if (query.dimensions.length === 0) {
    return ""
  }

  return `ORDER BY ${query.dimensions.map(escapeIdentifier).join(", ")}`
}

function buildSqlWithColumns(query: QueryConfig, columns: DatasetColumn[]) {
  const parameters: Array<string | number | null> = []
  const whereClause = buildWhereClause(query, columns, parameters)
  const selectClause = buildSelectClause(query)
  const groupByClause = buildGroupByClause(query)
  const orderByClause = buildOrderByClause(query)
  const limitClause = typeof query.limit === "number" ? `LIMIT ${query.limit}` : ""

  return {
    sql: [
      "WITH dataset_data AS (SELECT * FROM read_csv_auto(?, header = true))",
      selectClause,
      "FROM dataset_data",
      whereClause,
      groupByClause,
      orderByClause,
      limitClause,
    ]
      .filter(Boolean)
      .join(" "),
    parameters,
  }
}

function buildPreviewColumns(query: QueryConfig): PreviewColumn[] {
  return [
    ...(query.dimensions.map((dimension) => ({
      key: dimension,
      label: dimension.charAt(0).toUpperCase() + dimension.slice(1),
    })) as PreviewColumn[]),
    ...query.metrics.map((metric) => ({
      key: buildMetricKey(metric),
      label: buildMetricLabel(metric),
    })),
  ]
}

export function buildMetricLabel(metric: QueryConfig["metrics"][number]) {
  return metric.alias || `${metric.aggregation.toUpperCase()} ${metric.column}`
}

export function buildMetricKey(metric: QueryConfig["metrics"][number]) {
  return metricKey(metric.column, metric.aggregation, metric.alias)
}

export async function executeQuery(
  dataset: DatasetSummary,
  columns: DatasetColumn[],
  sourcePath: string,
  query: QueryConfig,
): Promise<Omit<QueryPreviewResult, "generatedAt" | "cached" | "executionMs"> & {
  executionMs: number
}> {
  const start = performance.now()
  const instance = await getDuckDBInstance()
  const connection = await DuckDBConnection.create(instance)

  try {
    const { sql, parameters } = buildSqlWithColumns(query, columns)
    const reader = await connection.runAndReadAll(sql, [sourcePath, ...parameters])
    await reader.readAll()
    const resultRows = reader.getRowObjectsJson() as Record<string, unknown>[]

    const previewRows = resultRows.map((row) => {
      const record: RecordRow = {}
      for (const [key, value] of Object.entries(row)) {
        if (value === null || value === undefined) {
          record[key] = null
        } else if (
          typeof value === "number" ||
          typeof value === "string" ||
          typeof value === "boolean"
        ) {
          record[key] = value
        } else {
          record[key] = String(value)
        }
      }
      return record
    })

    return {
      dataset,
      rowCount: previewRows.length,
      rows: previewRows,
      columns: buildPreviewColumns(query),
      executionMs: performance.now() - start,
    }
  } finally {
    connection.disconnectSync()
  }
}
