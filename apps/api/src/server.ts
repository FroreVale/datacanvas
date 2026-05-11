import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import Fastify from "fastify"
import {
  createChartRequestSchema,
  datasetUploadRequestSchema,
  datasetUploadResponseSchema,
  queryConfigSchema,
  queryPreviewErrorSchema,
  queryPreviewResultSchema,
  removeDatasetRequestSchema,
  removeChartRequestSchema,
  updateChartRequestSchema,
  updateDashboardLayoutRequestSchema,
} from "../../../packages/shared/src/index.ts"
import { createCache } from "./lib/cache.ts"
import { buildMetricKey, executeQuery } from "./lib/query-engine.ts"
import {
  canCreateCharts,
  canEditChart,
  canDeleteChart,
  canManageDatasets,
  canUpdateLayout,
  parseRole,
} from "./lib/permissions.ts"
import {
  createChart,
  createDatasetFromCsvFile,
  deleteDataset,
  deleteChart,
  ensureSeedData,
  getChartById,
  getDatasetById,
  getDatasetColumns,
  getDatasetSourcePath,
  getDashboardById,
  listDashboards,
  listDatasets,
  updateChart,
  updateDashboardLayout,
} from "./lib/storage.ts"

const moduleDir = dirname(fileURLToPath(import.meta.url))
const apiRoot = join(moduleDir, "..")
const uploadsDir = join(apiRoot, "uploads")
const sampleCsvPath = join(apiRoot, "data", "sample_sales_data.csv")
const previewCache = createCache<ReturnType<typeof queryPreviewResultSchema.parse>>(5 * 60_000)

mkdirSync(uploadsDir, { recursive: true })

function buildQueryError(
  message: string,
  issues: { path: (string | number)[]; message: string }[],
) {
  return queryPreviewErrorSchema.parse({
    message,
    issues,
  })
}

function resolveTableMode(query: ReturnType<typeof queryConfigSchema.parse>) {
  if (query.tableMode) {
    return query.tableMode
  }

  return query.tableColumns.length > 0 && query.dimensions.length === 0 && query.metrics.length === 0
    ? "raw"
    : "summary"
}

async function validateQueryAgainstDataset(
  query: ReturnType<typeof queryConfigSchema.parse>,
  datasetId: string,
) {
  const dataset = await getDatasetById(datasetId)
  if (!dataset) {
    return {
      ok: false as const,
      error: buildQueryError(`Unknown dataset: ${datasetId}`, []),
    }
  }

  const columns = new Map(dataset.columns.map((column) => [column.name, column]))
  const issues: { path: (string | number)[]; message: string }[] = []

  for (const dimension of query.dimensions) {
    if (!columns.has(dimension)) {
      issues.push({
        path: ["dimensions"],
        message: `Unknown dimension column: ${dimension}`,
      })
    }
  }

  for (const metric of query.metrics) {
    if (metric.aggregation === "count" && metric.column === "*") {
      continue
    }

    const column = columns.get(metric.column)
    if (!column) {
      issues.push({
        path: ["metrics"],
        message: `Unknown metric column: ${metric.column}`,
      })
      continue
    }

    if (metric.aggregation !== "count" && column.type !== "number") {
      issues.push({
        path: ["metrics"],
        message: `Aggregation ${metric.aggregation.toUpperCase()} requires a numeric column: ${metric.column}`,
      })
    }
  }

  if (query.chartType === "table") {
    const tableMode = resolveTableMode(query)

    if (tableMode === "summary") {
      if (query.dimensions.length === 0) {
        issues.push({
          path: ["dimensions"],
          message: "Summary tables require at least one grouping column",
        })
      }

      if (query.metrics.length === 0) {
        issues.push({
          path: ["metrics"],
          message: "Summary tables require at least one aggregate column",
        })
      }
    } else {
      if (query.tableColumns.length === 0) {
        issues.push({
          path: ["tableColumns"],
          message: "Raw tables require at least one displayed column",
        })
      }

      for (const columnName of query.tableColumns) {
        if (!columns.has(columnName)) {
          issues.push({
            path: ["tableColumns"],
            message: `Unknown table column: ${columnName}`,
          })
        }
      }
    }
  } else {
    if (query.dimensions.length === 0) {
      issues.push({
        path: ["dimensions"],
        message: `${query.chartType.toUpperCase()} charts require at least one dimension`,
      })
    }

    if (query.metrics.length === 0) {
      issues.push({
        path: ["metrics"],
        message: `${query.chartType.toUpperCase()} charts require at least one metric`,
      })
    }

    if (query.chartType === "pie") {
      if (query.dimensions.length !== 1) {
        issues.push({
          path: ["dimensions"],
          message: "Pie charts require exactly one category dimension",
        })
      }

      if (query.metrics.length !== 1) {
        issues.push({
          path: ["metrics"],
          message: "Pie charts require exactly one metric",
        })
      }
    }

    if (query.chartType === "line") {
      if (query.dimensions.length !== 1) {
        issues.push({
          path: ["dimensions"],
          message: "Line charts require exactly one time dimension",
        })
      }

      if (query.metrics.length !== 1) {
        issues.push({
          path: ["metrics"],
          message: "Line charts require exactly one metric",
        })
      }

      const dimensionName = query.dimensions[0]
      const selectedColumn = dimensionName ? columns.get(dimensionName) : undefined
      const hasDateColumn = dataset.columns.some((column) => column.type === "date")

      if (hasDateColumn && selectedColumn?.type !== "date") {
        issues.push({
          path: ["dimensions"],
          message: "Line charts should use a date dimension when the dataset has one",
        })
      }
    }
  }

  for (const filter of query.filters) {
    if (!columns.has(filter.column)) {
      issues.push({
        path: ["filters"],
        message: `Unknown filter column: ${filter.column}`,
      })
    }
  }

  if (issues.length > 0) {
    return {
      ok: false as const,
      error: buildQueryError("Invalid query configuration for dataset", issues),
    }
  }

  return {
    ok: true as const,
    dataset,
  }
}

function previewKey(datasetId: string, version: number, query: unknown) {
  return `${datasetId}:${version}:${JSON.stringify(query)}`
}

export async function buildServer() {
  const app = Fastify({ logger: false })

  await ensureSeedData(sampleCsvPath)

  app.get("/api/health", async () => ({ status: "ok" }))

  app.get("/api/datasets", async () => ({
    datasets: await listDatasets(),
  }))

  app.get<{ Params: { datasetId: string } }>(
    "/api/datasets/:datasetId",
    async (request, reply) => {
      const dataset = await getDatasetById(request.params.datasetId)
      if (!dataset) {
        return reply.code(404).send({ message: "Dataset not found" })
      }

      return {
        dataset,
      }
    },
  )

  app.delete<{ Params: { datasetId: string } }>(
    "/api/datasets/:datasetId",
    async (request, reply) => {
      const parsed = removeDatasetRequestSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.code(400).send({
          message: "Invalid dataset delete payload",
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path,
            message: issue.message,
          })),
        })
      }

      const body = parsed.data
      const role = parseRole(body.role)

      try {
        const result = await deleteDataset({
          datasetId: request.params.datasetId,
          role,
          ownerSessionId: body.ownerSessionId,
        })

        if (!result) {
          return reply.code(404).send({ message: "Dataset not found" })
        }

        return reply.code(204).send()
      } catch (error) {
        return reply.code(403).send({
          message: error instanceof Error ? error.message : "Unable to delete dataset",
        })
      }
    },
  )

  app.get("/api/dashboards", async () => ({
    dashboards: await listDashboards(),
  }))

  app.get<{ Params: { dashboardId: string } }>(
    "/api/dashboards/:dashboardId",
    async (request, reply) => {
      const dashboard = await getDashboardById(request.params.dashboardId)
      if (!dashboard) {
        return reply.code(404).send({ message: "Dashboard not found" })
      }

      return {
        dashboard,
      }
    },
  )

  app.post("/api/datasets/upload", async (request, reply) => {
    const parsed = datasetUploadRequestSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid dataset upload payload",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path,
          message: issue.message,
        })),
      })
    }

    const body = parsed.data
    const role = body.role ? parseRole(body.role) : "editor"
    if (!canManageDatasets(role)) {
      return reply.code(403).send({ message: "Only admins and editors can upload datasets" })
    }

    const safeFilename = body.filename.replace(/[^a-zA-Z0-9._-]+/g, "-")
    const filePath = join(uploadsDir, `${Date.now()}-${safeFilename}`)
    writeFileSync(filePath, body.csvText, "utf8")

    const dataset = await createDatasetFromCsvFile(filePath, body.filename, "upload")
    const response = datasetUploadResponseSchema.parse({ dataset })

    return reply.code(201).send(response)
  })

  app.post("/api/query/preview", async (request, reply) => {
    const parsed = queryConfigSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid query configuration",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path,
          message: issue.message,
        })),
      })
    }

    const query = parsed.data
    const validation = await validateQueryAgainstDataset(query, query.datasetId)
    if (!validation.ok) {
      return reply.code(400).send(validation.error)
    }

    const dataset = validation.dataset
    const sourcePath = await getDatasetSourcePath(dataset.id)
    const columns = await getDatasetColumns(dataset.id)

    if (!sourcePath || !columns) {
      return reply.code(404).send({
        message: `Dataset ${dataset.id} is missing source data`,
        issues: [],
      })
    }

    const cached = previewCache.get(previewKey(dataset.id, dataset.version, query))
    if (cached) {
      return {
        preview: {
          ...cached,
          cached: true,
        },
        metricKeys: query.metrics.map((metric) => buildMetricKey(metric)),
      }
    }

    const result = await executeQuery(dataset, columns, sourcePath, query)
    const preview = queryPreviewResultSchema.parse({
      ...result,
      generatedAt: new Date().toISOString(),
      cached: false,
    })

    previewCache.set(previewKey(dataset.id, dataset.version, query), preview)

    return {
      preview,
      metricKeys: query.metrics.map((metric) => buildMetricKey(metric)),
    }
  })

  app.post("/api/charts", async (request, reply) => {
    const parsed = createChartRequestSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid chart payload",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path,
          message: issue.message,
        })),
      })
    }

    const body = parsed.data
    const role = parseRole(body.role)
    if (!canCreateCharts(role)) {
      return reply.code(403).send({ message: "This role cannot create charts" })
    }

    const chart = await createChart({
      dashboardId: body.dashboardId,
      datasetId: body.datasetId,
      title: body.title,
      chartType: body.chartType,
      query: body.query,
      position: body.position,
      ownerSessionId: body.ownerSessionId,
    })

    return reply.code(201).send({ chart })
  })

  app.patch<{ Params: { chartId: string } }>(
    "/api/charts/:chartId",
    async (request, reply) => {
      const parsed = updateChartRequestSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.code(400).send({
          message: "Invalid chart update payload",
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path,
            message: issue.message,
          })),
        })
      }

      const body = parsed.data
      const role = parseRole(body.role)
      const existing = await getChartById(request.params.chartId)
      if (!existing) {
        return reply.code(404).send({ message: "Chart not found" })
      }

      if (!canEditChart(role, existing, body.ownerSessionId)) {
        return reply.code(403).send({ message: "This role cannot update that chart" })
      }

      try {
        const chart = await updateChart({
          chartId: request.params.chartId,
          expectedVersion: body.expectedVersion,
          role,
          ownerSessionId: body.ownerSessionId,
          title: body.title,
          chartType: body.chartType,
          query: body.query,
          position: body.position,
        })

        if (!chart) {
          return reply.code(404).send({ message: "Chart not found" })
        }

        return { chart }
      } catch (error) {
        return reply.code(409).send({
          message: error instanceof Error ? error.message : "Unable to update chart",
        })
      }
    },
  )

  app.delete<{ Params: { chartId: string } }>(
    "/api/charts/:chartId",
    async (request, reply) => {
      const parsed = removeChartRequestSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.code(400).send({
          message: "Invalid chart delete payload",
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path,
            message: issue.message,
          })),
        })
      }

      const body = parsed.data
      const role = parseRole(body.role)
      const existing = await getChartById(request.params.chartId)
      if (!existing) {
        return reply.code(404).send({ message: "Chart not found" })
      }

      if (!canDeleteChart(role, existing, body.ownerSessionId)) {
        return reply.code(403).send({ message: "This role cannot delete that chart" })
      }

      try {
        await deleteChart({
          chartId: request.params.chartId,
          role,
          ownerSessionId: body.ownerSessionId,
        })
        return reply.code(204).send()
      } catch (error) {
        return reply.code(409).send({
          message: error instanceof Error ? error.message : "Unable to delete chart",
        })
      }
    },
  )

  app.patch<{ Params: { dashboardId: string } }>(
    "/api/dashboards/:dashboardId/layout",
    async (request, reply) => {
      const parsed = updateDashboardLayoutRequestSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.code(400).send({
          message: "Invalid dashboard layout payload",
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path,
            message: issue.message,
          })),
        })
      }

      const body = parsed.data
      const role = parseRole(body.role)
      if (!canUpdateLayout(role)) {
        return reply.code(403).send({ message: "This role cannot update dashboard layouts" })
      }

      try {
        const dashboard = await updateDashboardLayout({
          dashboardId: request.params.dashboardId,
          items: body.items,
          expectedVersion: body.expectedVersion,
          role,
        })

        if (!dashboard) {
          return reply.code(404).send({ message: "Dashboard not found" })
        }

        return { dashboard }
      } catch (error) {
        return reply.code(409).send({
          message: error instanceof Error ? error.message : "Unable to update dashboard layout",
        })
      }
    },
  )

  return app
}

export type AppServer = Awaited<ReturnType<typeof buildServer>>
