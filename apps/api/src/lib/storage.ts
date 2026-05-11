import { randomUUID } from "node:crypto"
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import {
  type Chart as PrismaChart,
  type Dashboard as PrismaDashboard,
  type Dataset as PrismaDataset,
} from "../../generated/prisma/index.js"
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
import { prisma } from "./prisma.ts"

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const uploadsDir = join(apiRoot, "uploads")
mkdirSync(uploadsDir, { recursive: true })

function toSourceKind(sourceKind: string): "upload" | "seed" {
  return sourceKind.toLowerCase() === "seed" ? "seed" : "upload"
}

function parseDatasetRow(row: PrismaDataset): DatasetSummary {
  return datasetSummarySchema.parse({
    id: row.id,
    name: row.name,
    description: row.description,
    sourceFilename: row.sourceFilename,
    sourceKind: toSourceKind(row.sourceKind),
    version: row.version,
    rowCount: row.rowCount,
    columns: row.columnsJson as DatasetSummary["columns"],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  })
}

function parseDashboardRow(row: PrismaDashboard, charts: Chart[]): Dashboard {
  return dashboardSchema.parse({
    id: row.id,
    title: row.title,
    description: row.description,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    charts,
  })
}

function parseChartRow(row: PrismaChart): Chart {
  const rawPosition = row.positionJson as Partial<ChartPosition> & {
    order?: number
    x?: number
    y?: number
  }
  const order = Number(rawPosition.order ?? 0)
  const x = Number(rawPosition.x ?? order % 12)
  const y = Number(rawPosition.y ?? Math.floor(order / 2) * 4)

  return chartSchema.parse({
    id: row.id,
    dashboardId: row.dashboardId,
    datasetId: row.datasetId,
    title: row.title,
    chartType: row.chartType,
    query: row.queryJson as QueryConfig,
    position: {
      order,
      x,
      y,
      width: Number(rawPosition.width ?? 6),
      height: Number(rawPosition.height ?? 4),
    },
    version: row.version,
    ownerSessionId: row.ownerSessionId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  })
}

async function readChartRowsByDashboard(dashboardId: string) {
  const rows = await prisma.chart.findMany({
    where: { dashboardId },
    orderBy: { createdAt: "asc" },
  })

  return rows.sort((left, right) => {
    const leftPosition = left.positionJson as Partial<ChartPosition>
    const rightPosition = right.positionJson as Partial<ChartPosition>
    const leftY = Number(leftPosition.y ?? 0)
    const rightY = Number(rightPosition.y ?? 0)
    if (leftY !== rightY) {
      return leftY - rightY
    }
    return Number(leftPosition.x ?? 0) - Number(rightPosition.x ?? 0)
  })
}

async function readDatasetRow(datasetId: string) {
  return prisma.dataset.findUnique({
    where: { id: datasetId },
  })
}

async function writeDatasetRecord(input: {
  id?: string
  name: string
  description: string
  sourceFilename: string
  sourceKind: "upload" | "seed"
  sourcePath: string
  columns: DatasetSummary["columns"]
  rowCount: number
}) {
  const record = await prisma.dataset.create({
    data: {
      id: input.id ?? randomUUID(),
      name: input.name,
      description: input.description,
      sourceFilename: input.sourceFilename,
      sourceKind: input.sourceKind === "seed" ? "SEED" : "UPLOAD",
      sourcePath: input.sourcePath,
      rowCount: input.rowCount,
      columnsJson: input.columns,
    },
  })

  return parseDatasetRow(record)
}

async function writeDashboardRecord(input: {
  id?: string
  title: string
  description: string
}) {
  const record = await prisma.dashboard.create({
    data: {
      id: input.id ?? randomUUID(),
      title: input.title,
      description: input.description,
    },
  })

  const dashboard = await getDashboardById(record.id)
  if (!dashboard) {
    throw new Error("Failed to create dashboard record")
  }

  return dashboard
}

async function writeChartRecord(input: {
  id?: string
  dashboardId: string
  datasetId: string
  title: string
  chartType: ChartType
  query: QueryConfig
  position: ChartPosition
  ownerSessionId: string
}) {
  const record = await prisma.chart.create({
    data: {
      id: input.id ?? randomUUID(),
      dashboardId: input.dashboardId,
      datasetId: input.datasetId,
      title: input.title,
      chartType: input.chartType,
      queryJson: input.query,
    positionJson: input.position,
      ownerSessionId: input.ownerSessionId,
    },
  })

  return parseChartRow(record)
}

export async function listDatasets(): Promise<DatasetSummary[]> {
  const rows = await prisma.dataset.findMany({
    orderBy: { createdAt: "desc" },
  })
  return rows.map(parseDatasetRow)
}

export async function getDatasetById(datasetId: string): Promise<DatasetSummary | null> {
  const row = await readDatasetRow(datasetId)
  return row ? parseDatasetRow(row) : null
}

export async function getDatasetDetailById(datasetId: string): Promise<DatasetDetail | null> {
  const row = await readDatasetRow(datasetId)
  return row ? datasetDetailSchema.parse(parseDatasetRow(row)) : null
}

export async function getDatasetSourcePath(datasetId: string) {
  const row = await readDatasetRow(datasetId)
  return row?.sourcePath ?? null
}

export async function getDatasetColumns(datasetId: string) {
  const row = await readDatasetRow(datasetId)
  if (!row) {
    return null
  }

  return row.columnsJson as DatasetDetail["columns"]
}

export async function listDashboards(): Promise<Dashboard[]> {
  const rows = await prisma.dashboard.findMany({
    orderBy: { createdAt: "desc" },
  })

  const dashboards = await Promise.all(
    rows.map(async (row) => {
      const charts = (await readChartRowsByDashboard(row.id)).map(parseChartRow)
      return parseDashboardRow(row, charts)
    }),
  )

  return dashboards
}

export async function getDashboardById(dashboardId: string): Promise<Dashboard | null> {
  const row = await prisma.dashboard.findUnique({
    where: { id: dashboardId },
  })

  if (!row) {
    return null
  }

  const charts = (await readChartRowsByDashboard(dashboardId)).map(parseChartRow)
  return parseDashboardRow(row, charts)
}

export async function listCharts() {
  return prisma.chart.findMany({
    orderBy: { createdAt: "desc" },
  })
}

export async function getChartById(chartId: string): Promise<Chart | null> {
  const row = await prisma.chart.findUnique({
    where: { id: chartId },
  })

  return row ? parseChartRow(row) : null
}

export async function createDatasetFromCsvFile(
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

export async function createDatasetFromCsvText(input: {
  filename: string
  csvText: string
  sourceKind: "upload" | "seed"
  sourcePath: string
}) {
  const parsed = inferCsvDataset(input.filename, input.csvText)

  writeFileSync(input.sourcePath, input.csvText, "utf8")

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

export async function createDashboard(input: {
  title: string
  description: string
}) {
  return writeDashboardRecord(input)
}

export async function createChart(input: {
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

export async function updateChart(input: {
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

  const existing = await getChartById(input.chartId)
  if (!existing) {
    return null
  }

  if (existing.version !== input.expectedVersion) {
    throw new Error("Chart has been updated by someone else")
  }

  if (input.role === "viewer") {
    throw new Error("Viewers cannot edit charts")
  }

  if (input.role === "editor" && existing.ownerSessionId !== input.ownerSessionId) {
    throw new Error("Editors can only edit their own charts")
  }

  const next = {
    title: input.title ?? existing.title,
    chartType: input.chartType ?? existing.chartType,
    query: input.query ?? existing.query,
    position: input.position ?? existing.position,
    version: existing.version + 1,
  }

  const record = await prisma.chart.update({
    where: { id: input.chartId },
    data: {
      title: next.title,
      chartType: next.chartType,
      queryJson: next.query,
      positionJson: next.position,
      version: next.version,
    },
  })

  return parseChartRow(record)
}

export async function deleteChart(input: {
  chartId: string
  role: Role
  ownerSessionId: string
}) {
  roleSchema.parse(input.role)

  const existing = await getChartById(input.chartId)
  if (!existing) {
    return false
  }

  if (input.role === "viewer") {
    throw new Error("Viewers cannot delete charts")
  }

  if (input.role === "editor" && existing.ownerSessionId !== input.ownerSessionId) {
    throw new Error("Editors can only delete their own charts")
  }

  await prisma.chart.delete({
    where: { id: input.chartId },
  })
  return true
}

export async function deleteDataset(input: {
  datasetId: string
  role: Role
  ownerSessionId: string
}) {
  roleSchema.parse(input.role)

  const existing = await getDatasetById(input.datasetId)
  if (!existing) {
    return false
  }

  if (input.role !== "admin") {
    throw new Error("Only admins can delete datasets")
  }

  const charts = await prisma.chart.findMany({
    where: { datasetId: input.datasetId },
    select: { id: true },
  })

  const sourcePath = await getDatasetSourcePath(input.datasetId)

  await prisma.$transaction([
    prisma.chart.deleteMany({
      where: { datasetId: input.datasetId },
    }),
    prisma.dataset.delete({
      where: { id: input.datasetId },
    }),
  ])

  if (sourcePath) {
    try {
      unlinkSync(sourcePath)
    } catch {
      // Ignore missing files. The database record is the source of truth.
    }
  }

  return { chartCount: charts.length }
}

export async function updateDashboardLayout(input: {
  dashboardId: string
  items: Array<{
    chartId: string
    order: number
    x: number
    y: number
    width: number
    height: number
  }>
  expectedVersion: number
  role: Role
}) {
  roleSchema.parse(input.role)

  const dashboard = await getDashboardById(input.dashboardId)
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
  }

  await prisma.$transaction([
    ...input.items.map((item) =>
      prisma.chart.update({
        where: { id: item.chartId },
        data: {
      positionJson: {
          order: item.order,
            x: item.x,
            y: item.y,
            width: item.width,
            height: item.height,
          },
          version: {
            increment: 1,
          },
        },
      }),
    ),
    prisma.dashboard.update({
      where: { id: input.dashboardId },
      data: {
        version: {
          increment: 1,
        },
      },
    }),
  ])

  return getDashboardById(input.dashboardId)
}

export async function ensureSeedData(sampleFilePath: string) {
  const [datasetCount, dashboardCount] = await Promise.all([
    prisma.dataset.count(),
    prisma.dashboard.count(),
  ])

  let dataset = (await listDatasets())[0] ?? null

  if (datasetCount === 0) {
    dataset = await createDatasetFromCsvFile(sampleFilePath, "sample_sales_data.csv", "seed")
  }

  let dashboard = (await listDashboards())[0] ?? null

  if (dashboardCount === 0 && dataset) {
    dashboard = await createDashboard({
      title: "Revenue Overview",
      description: "Seed dashboard based on the bundled sales CSV.",
    })

    if (dashboard) {
      await createChart({
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
        position: { order: 0, x: 0, y: 0, width: 6, height: 4 },
        ownerSessionId: "seed-session",
      })

      await createChart({
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
        position: { order: 1, x: 6, y: 0, width: 6, height: 4 },
        ownerSessionId: "seed-session",
      })

      await createChart({
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
        position: { order: 2, x: 0, y: 4, width: 4, height: 4 },
        ownerSessionId: "seed-session",
      })
    }
  }

  return {
    dataset: dataset ?? (await listDatasets())[0] ?? null,
    dashboard: dashboard ?? (await listDashboards())[0] ?? null,
  }
}

export async function datasetSnapshot(datasetId: string) {
  const summary = await getDatasetById(datasetId)
  if (!summary) {
    return null
  }

  return {
    summary,
    sourcePath: await getDatasetSourcePath(datasetId),
  }
}
