import { DatabaseSync } from "node:sqlite"
import type {
  DatasetColumn,
  DatasetSummary,
  QueryConfig,
  QueryPreviewResult,
  QueryValue,
  PreviewColumn,
} from "../../../../packages/shared/src/index.ts"

type RecordRow = Record<string, QueryValue>

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
        clauses.push(`LOWER(CAST(${escapedColumn} AS TEXT)) LIKE LOWER(?)`)
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
        return `${metric.aggregation.toUpperCase()}(CAST(${escapeIdentifier(metric.column)} AS REAL)) AS ${escapeIdentifier(alias)}`
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

function columnSqlType(column: DatasetColumn) {
  switch (column.type) {
    case "number":
      return "REAL"
    case "boolean":
      return "INTEGER"
    default:
      return "TEXT"
  }
}

function normalizeRowValue(value: QueryValue, column: DatasetColumn): string | number | null {
  if (value === null) {
    return null
  }

  switch (column.type) {
    case "number":
      return Number(value)
    case "boolean":
      return value === true || value === 1 ? 1 : 0
    case "date":
      return String(value)
    default:
      return String(value)
  }
}

function createExecutionDatabase(columns: DatasetColumn[], rows: RecordRow[]) {
  const database = new DatabaseSync(":memory:")
  const columnDefinitions = columns
    .map((column) => `${escapeIdentifier(column.name)} ${columnSqlType(column)}`)
    .join(", ")

  database.exec(`CREATE TABLE dataset_data (${columnDefinitions})`)
  const placeholders = columns.map(() => "?").join(", ")
  const insert = database.prepare(
    `INSERT INTO dataset_data (${columns.map((column) => escapeIdentifier(column.name)).join(", ")}) VALUES (${placeholders})`,
  )

  for (const record of rows) {
    const values = columns.map((column) => normalizeRowValue(record[column.name], column)) as Array<
      string | number | null
    >
    insert.run(...(values as any))
  }
  return database
}

export function buildMetricLabel(metric: QueryConfig["metrics"][number]) {
  return metric.alias || `${metric.aggregation.toUpperCase()} ${metric.column}`
}

export function buildMetricKey(metric: QueryConfig["metrics"][number]) {
  return metricKey(metric.column, metric.aggregation, metric.alias)
}

export function executeQuery(
  dataset: DatasetSummary,
  columns: DatasetColumn[],
  rows: RecordRow[],
  query: QueryConfig,
): Omit<QueryPreviewResult, "generatedAt" | "cached" | "executionMs"> & {
  executionMs: number
} {
  const start = performance.now()
  const database = createExecutionDatabase(columns, rows)
  try {
    const { sql, parameters } = buildSqlWithColumns(query, columns)
    const statement = database.prepare(sql)
    const resultRows = statement.all(...parameters) as Record<string, unknown>[]

    const previewRows = resultRows.map((row) => {
      const record: RecordRow = {}
      for (const [key, value] of Object.entries(row)) {
        if (value === null || value === undefined) {
          record[key] = null
        } else if (typeof value === "number" || typeof value === "string" || typeof value === "boolean") {
          record[key] = value
        } else {
          record[key] = String(value)
        }
      }
      return record
    })

    const columnsResult: PreviewColumn[] = [
      ...(query.dimensions.map((dimension) => ({
        key: dimension,
        label: dimension.charAt(0).toUpperCase() + dimension.slice(1),
      })) as PreviewColumn[]),
      ...query.metrics.map((metric) => ({
        key: buildMetricKey(metric),
        label: buildMetricLabel(metric),
      })),
    ]

    return {
      dataset,
      rowCount: previewRows.length,
      rows: previewRows,
      columns: columnsResult,
      executionMs: performance.now() - start,
    }
  } finally {
    database.close()
  }
}
