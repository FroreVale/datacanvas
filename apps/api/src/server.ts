import Fastify from "fastify"
import {
  datasets,
  getDatasetRows,
} from "./data/sample-datasets"
import {
  buildMetricKey,
  previewQuery,
} from "./lib/query-engine"
import {
  queryConfigSchema,
  queryPreviewErrorSchema,
  queryPreviewResultSchema,
} from "../../../packages/shared/src/index.ts"

function parseQuery(body: unknown) {
  const result = queryConfigSchema.safeParse(body)

  if (!result.success) {
    return {
      ok: false as const,
      error: queryPreviewErrorSchema.parse({
        message: "Invalid query configuration",
        issues: result.error.issues.map((issue) => ({
          path: issue.path,
          message: issue.message,
        })),
      }),
    }
  }

  return {
    ok: true as const,
    value: result.data,
  }
}

export function buildServer() {
  const app = Fastify({
    logger: false,
  })

  app.get("/api/health", async () => ({ status: "ok" }))

  app.get("/api/datasets", async () => ({
    datasets,
  }))

  app.get<{ Params: { datasetId: string } }>(
    "/api/datasets/:datasetId",
    async (request, reply) => {
      const dataset = datasets.find((item) => item.id === request.params.datasetId)

      if (!dataset) {
        return reply.code(404).send({ message: "Dataset not found" })
      }

      return {
        dataset,
      }
    },
  )

  app.post("/api/query/preview", async (request, reply) => {
    const parsed = parseQuery(request.body)

    if (!parsed.ok) {
      return reply.code(400).send(parsed.error)
    }

    const query = parsed.value
    const dataset = datasets.find((item) => item.id === query.datasetId)

    if (!dataset) {
      return reply.code(404).send({
        message: `Unknown dataset: ${query.datasetId}`,
        issues: [],
      })
    }

    const preview = previewQuery(dataset, getDatasetRows(dataset.id), query)
    const parsedPreview = queryPreviewResultSchema.parse(preview)

    return {
      preview: parsedPreview,
      metricKeys: query.metrics.map((metric) => buildMetricKey(metric)),
    }
  })

  return app
}

export type AppServer = ReturnType<typeof buildServer>
