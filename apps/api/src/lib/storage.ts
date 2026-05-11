import { DatabaseSync } from "node:sqlite"
import { randomUUID } from "node:crypto"
import { mkdirSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import {
  chartPositionSchema,
  chartSchema,
  chartTypeSchema,
  datasetDetailSchema,
  datasetSummarySchema,
  dashboardSchema,
  queryConfigSchema,
  roleSchema,
  type Chart,
  type ChartPosition,
  type ChartType,
  type DatasetDetail,
  type DatasetSummary,
  type Dashboard,
  type QueryConfig,
  type Role,
} from "../../../../packages/shared/src/index.ts"
import { inferCsvDataset } from "./csv.ts"

type DatasetRow = {
  id: string
  name: string
  description: string
  sourceFilename: string
  sourceKind: string
  sourcePath: string
  version: number
  rowCount: number
  columnsJson: string
  createdAt: string
  updatedAt: string
}

type DashboardRow = {
  id: string
  title: string
  description: string
  version: number
  createdAt: string
  updatedAt: string
}

type ChartRow = {
  id: string
  dashboardId: string
  datasetId: string
  title: string
  chartType: string
  queryJson: string
  positionJson: string
  version: number
  ownerSessionId: string
  createdAt: string
  updatedAt: string
}

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const dbPath = join(apiRoot, "dev.db")
const uploadsDir = join(apiRoot, "uploads")
const db = new DatabaseSync(dbPath)
mkdirSync(dirname(dbPath), { recursive: true })
mkdirSync(uploadsDir, { recursive: true })

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS datasets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    sourceFilename TEXT NOT NULL,
    sourceKind TEXT NOT NULL,
    sourcePath TEXT NOT NULL,
    version INTEGER NOT NULL,
    rowCount INTEGER NOT NULL,
    columnsJson TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS dashboards (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    version INTEGER NOT NULL,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS charts (
    id TEXT PRIMARY KEY,
    dashboardId TEXT NOT NULL,
    datasetId TEXT NOT NULL,
    title TEXT NOT NULL,
    chartType TEXT NOT NULL,
    queryJson TEXT NOT NULL,
    positionJson TEXT NOT NULL,
    version INTEGER NOT NULL,
    ownerSessionId TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY (dashboardId) REFERENCES dashboards(id) ON DELETE CASCADE,
    FOREIGN KEY (datasetId) REFERENCES datasets(id) ON DELETE RESTRICT
  );
`)

function now() {
  return new Date().toISOString()
}

function parseDatasetRow(row: DatasetRow): DatasetSummary {
  return datasetSummarySchema.parse({
    id: row.id,
    name: row.name,
    description: row.description,
    sourceFilename: row.sourceFilename,
    sourceKind: row.sourceKind,
    version: row.version,
    rowCount: row.rowCount,
    columns: JSON.parse(row.columnsJson) as unknown,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  })
}

function parseDashboardRow(row: DashboardRow, charts: Chart[]): Dashboard {
  return dashboardSchema.parse({
    id: row.id,
    title: row.title,
    description: row.description,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    charts,
  })
}

function parseChartRow(row: ChartRow): Chart {
  return chartSchema.parse({
    id: row.id,
    dashboardId: row.dashboardId,
    datasetId: row.datasetId,
    title: row.title,
    chartType: row.chartType,
    query: JSON.parse(row.queryJson) as unknown,
    position: JSON.parse(row.positionJson) as unknown,
    version: row.version,
    ownerSessionId: row.ownerSessionId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  })
}

function readDatasetRow(datasetId: string) {
  return db
    .prepare("SELECT * FROM datasets WHERE id = ?")
    .get(datasetId) as DatasetRow | undefined
}

function readChartRowsByDashboard(dashboardId: string) {
  return db
    .prepare("SELECT * FROM charts WHERE dashboardId = ? ORDER BY json_extract(positionJson, '$.order') ASC, createdAt ASC")
    .all(dashboardId) as ChartRow[]
}

function writeDatasetRecord(input: {
  id?: string
  name: string
  description: string
  sourceFilename: string
  sourceKind: "upload" | "seed"
  sourcePath: string
  columns: unknown
  rowCount: number
}) {
  const id = input.id ?? randomUUID()
  const timestamp = now()
  db.prepare(
    `
      INSERT INTO datasets (id, name, description, sourceFilename, sourceKind, sourcePath, version, rowCount, columnsJson, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  ).run(
    id,
    input.name,
    input.description,
    input.sourceFilename,
    input.sourceKind,
    input.sourcePath,
    1,
    input.rowCount,
    JSON.stringify(input.columns),
    timestamp,
    timestamp,
  )

  const record = readDatasetRow(id)
  if (!record) {
    throw new Error("Failed to create dataset record")
  }

  return parseDatasetRow(record)
}

function writeDashboardRecord(input: {
  id?: string
  title: string
  description: string
}) {
  const id = input.id ?? randomUUID()
  const timestamp = now()
  db.prepare(
    `
      INSERT INTO dashboards (id, title, description, version, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
  ).run(id, input.title, input.description, 1, timestamp, timestamp)

  const dashboard = getDashboardById(id)
  if (!dashboard) {
    throw new Error("Failed to create dashboard record")
  }

  return dashboard
}

function writeChartRecord(input: {
  id?: string
  dashboardId: string
  datasetId: string
  title: string
  chartType: ChartType
  query: QueryConfig
  position: ChartPosition
  ownerSessionId: string
}) {
  const id = input.id ?? randomUUID()
  const timestamp = now()
  db.prepare(
    `
      INSERT INTO charts (id, dashboardId, datasetId, title, chartType, queryJson, positionJson, version, ownerSessionId, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  ).run(
    id,
    input.dashboardId,
    input.datasetId,
    input.title,
    input.chartType,
    JSON.stringify(input.query),
    JSON.stringify(input.position),
    1,
    input.ownerSessionId,
    timestamp,
    timestamp,
  )

  const row = db.prepare("SELECT * FROM charts WHERE id = ?").get(id) as
    | ChartRow
    | undefined

  if (!row) {
    throw new Error("Failed to create chart")
  }

  return parseChartRow(row)
}

export function listDatasets(): DatasetSummary[] {
  const rows = db.prepare("SELECT * FROM datasets ORDER BY createdAt DESC").all() as DatasetRow[]
  return rows.map(parseDatasetRow)
}

export function getDatasetById(datasetId: string): DatasetSummary | null {
  const row = readDatasetRow(datasetId)
  return row ? parseDatasetRow(row) : null
}

export function getDatasetDetailById(datasetId: string): DatasetDetail | null {
  const row = readDatasetRow(datasetId)
  return row ? datasetDetailSchema.parse(parseDatasetRow(row)) : null
}

export function getDatasetSourcePath(datasetId: string) {
  const row = readDatasetRow(datasetId)
  return row?.sourcePath ?? null
}

export function getDatasetColumns(datasetId: string) {
  const row = readDatasetRow(datasetId)
  if (!row) {
    return null
  }

  return JSON.parse(row.columnsJson) as DatasetDetail["columns"]
}

export function listDashboards(): Dashboard[] {
  const rows = db.prepare("SELECT * FROM dashboards ORDER BY createdAt DESC").all() as DashboardRow[]
  return rows.map((row) => {
    const charts = readChartRowsByDashboard(row.id).map(parseChartRow)
    return parseDashboardRow(row, charts)
  })
}

export function getDashboardById(dashboardId: string): Dashboard | null {
  const row = db
    .prepare("SELECT * FROM dashboards WHERE id = ?")
    .get(dashboardId) as DashboardRow | undefined

  if (!row) {
    return null
  }

  const charts = readChartRowsByDashboard(dashboardId).map(parseChartRow)
  return parseDashboardRow(row, charts)
}

export function listCharts() {
  return db
    .prepare("SELECT * FROM charts ORDER BY createdAt DESC")
    .all() as ChartRow[]
}

export function getChartById(chartId: string): Chart | null {
  const row = db.prepare("SELECT * FROM charts WHERE id = ?").get(chartId) as
    | ChartRow
    | undefined

  return row ? parseChartRow(row) : null
}

export function createDatasetFromCsvFile(
  sourcePath: string,
  sourceFilename: string,
  sourceKind: "upload" | "seed",
) {
  const { name, description, columns, rows } = inferCsvDataset(
    sourceFilename,
    readFileSync(sourcePath, "utf8"),
  )

  return writeDatasetRecord({
    name,
    description,
    sourceFilename,
    sourceKind,
    sourcePath,
    columns,
    rowCount: rows.length,
  })
}

export function createDatasetFromCsvText(input: {
  filename: string
  csvText: string
  sourceKind: "upload" | "seed"
  sourcePath: string
}) {
  const parsed = inferCsvDataset(input.filename, input.csvText)

  return writeDatasetRecord({
    name: parsed.name,
    description: parsed.description,
    sourceFilename: parsed.sourceFilename,
    sourceKind: input.sourceKind,
    sourcePath: input.sourcePath,
    columns: parsed.columns,
    rowCount: parsed.rows.length,
  })
}

export function createDashboard(input: {
  title: string
  description: string
}) {
  return writeDashboardRecord(input)
}

export function createChart(input: {
  dashboardId: string
  datasetId: string
  title: string
  chartType: ChartType
  query: QueryConfig
  position: ChartPosition
  ownerSessionId: string
}) {
  queryConfigSchema.parse(input.query)
  chartPositionSchema.parse(input.position)
  chartTypeSchema.parse(input.chartType)
  return writeChartRecord(input)
}

export function updateChart(input: {
  chartId: string
  title?: string
  chartType?: ChartType
  query?: QueryConfig
  position?: ChartPosition
  expectedVersion: number
  role: Role
  ownerSessionId: string
}) {
  roleSchema.parse(input.role)

  const existing = getChartById(input.chartId)
  if (!existing) {
    return null
  }

  if (existing.version !== input.expectedVersion) {
    throw new Error("Chart has been updated by someone else")
  }

  if (input.role === "viewer") {
    throw new Error("Viewers cannot edit charts")
  }

  if (
    input.role === "editor" &&
    existing.ownerSessionId !== input.ownerSessionId
  ) {
    throw new Error("Editors can only edit their own charts")
  }

  const next = {
    title: input.title ?? existing.title,
    chartType: input.chartType ?? existing.chartType,
    query: input.query ?? existing.query,
    position: input.position ?? existing.position,
    version: existing.version + 1,
  }

  db.prepare(
    `
      UPDATE charts
      SET title = ?, chartType = ?, queryJson = ?, positionJson = ?, version = ?, updatedAt = ?
      WHERE id = ?
    `,
  ).run(
    next.title,
    next.chartType,
    JSON.stringify(next.query),
    JSON.stringify(next.position),
    next.version,
    now(),
    input.chartId,
  )

  return getChartById(input.chartId)
}

export function deleteChart(input: {
  chartId: string
  role: Role
  ownerSessionId: string
}) {
  roleSchema.parse(input.role)

  const existing = getChartById(input.chartId)
  if (!existing) {
    return false
  }

  if (input.role === "viewer") {
    throw new Error("Viewers cannot delete charts")
  }

  if (
    input.role === "editor" &&
    existing.ownerSessionId !== input.ownerSessionId
  ) {
    throw new Error("Editors can only delete their own charts")
  }

  db.prepare("DELETE FROM charts WHERE id = ?").run(input.chartId)
  return true
}

export function updateDashboardLayout(input: {
  dashboardId: string
  items: Array<{
    chartId: string
    order: number
    width: number
    height: number
  }>
  expectedVersion: number
  role: Role
}) {
  roleSchema.parse(input.role)

  const dashboard = getDashboardById(input.dashboardId)
  if (!dashboard) {
    throw new Error("Dashboard not found")
  }

  if (dashboard.version !== input.expectedVersion) {
    throw new Error("Dashboard has been updated by someone else")
  }

  if (input.role === "viewer") {
    throw new Error("Viewers cannot update dashboards")
  }

  const existingCharts = new Map(dashboard.charts.map((chart) => [chart.id, chart]))

  for (const item of input.items) {
    if (!existingCharts.has(item.chartId)) {
      throw new Error(`Unknown chart in layout: ${item.chartId}`)
    }
    db.prepare(
      `UPDATE charts SET positionJson = ?, updatedAt = ?, version = version + 1 WHERE id = ?`,
    ).run(
      JSON.stringify({
        order: item.order,
        width: item.width,
        height: item.height,
      }),
      now(),
      item.chartId,
    )
  }

  db.prepare(
    `UPDATE dashboards SET version = version + 1, updatedAt = ? WHERE id = ?`,
  ).run(now(), input.dashboardId)

  return getDashboardById(input.dashboardId)
}

export function getDatasetRows(datasetId: string) {
  const sourcePath = getDatasetSourcePath(datasetId)
  if (!sourcePath) {
    return null
  }

  const fileContents = readFileSync(sourcePath, "utf8")
  return inferCsvDataset(`${datasetId}.csv`, fileContents).rows
}

export function ensureSeedData(sampleFilePath: string) {
  const hasDataset = listDatasets().length > 0
  const hasDashboard = listDashboards().length > 0

  let dataset = listDatasets()[0] ?? null

  if (!hasDataset) {
    dataset = createDatasetFromCsvFile(sampleFilePath, "sample_sales_data.csv", "seed")
  }

  let dashboard = listDashboards()[0] ?? null

  if (!hasDashboard && dataset) {
    dashboard = createDashboard({
      title: "Revenue Overview",
      description: "Seed dashboard based on the bundled sales CSV.",
    })

    if (dashboard) {
      createChart({
        dashboardId: dashboard.id,
        datasetId: dataset.id,
        title: "Revenue by Product",
        chartType: "bar",
        query: {
          datasetId: dataset.id,
          dimensions: ["product"],
          metrics: [
            {
              column: "revenue",
              aggregation: "sum",
              alias: "total_revenue",
            },
          ],
          filters: [],
          limit: 10,
        },
        position: { order: 0, width: 6, height: 4 },
        ownerSessionId: "seed-session",
      })

      createChart({
        dashboardId: dashboard.id,
        datasetId: dataset.id,
        title: "Revenue Over Time",
        chartType: "line",
        query: {
          datasetId: dataset.id,
          dimensions: ["date"],
          metrics: [
            {
              column: "revenue",
              aggregation: "sum",
              alias: "total_revenue",
            },
          ],
          filters: [],
          limit: 20,
        },
        position: { order: 1, width: 6, height: 4 },
        ownerSessionId: "seed-session",
      })

      createChart({
        dashboardId: dashboard.id,
        datasetId: dataset.id,
        title: "Regional Mix",
        chartType: "pie",
        query: {
          datasetId: dataset.id,
          dimensions: ["region"],
          metrics: [
            {
              column: "quantity",
              aggregation: "sum",
              alias: "units",
            },
          ],
          filters: [],
          limit: 10,
        },
        position: { order: 2, width: 4, height: 4 },
        ownerSessionId: "seed-session",
      })
    }
  }

  return {
    dataset: dataset ?? listDatasets()[0] ?? null,
    dashboard: dashboard ?? listDashboards()[0] ?? null,
  }
}

export function datasetSnapshot(datasetId: string) {
  const summary = getDatasetById(datasetId)
  if (!summary) {
    return null
  }

  return {
    summary,
    sourcePath: getDatasetSourcePath(datasetId),
  }
}
