import {
  chartSchema,
  dashboardSchema,
  datasetDetailSchema,
  datasetSummarySchema,
  datasetUploadRequestSchema,
  datasetUploadResponseSchema,
  queryConfigSchema,
  queryPreviewResultSchema,
  type Chart,
  type Dashboard,
  type DatasetDetail,
  type DatasetSummary,
  type DatasetUploadRequest,
  type QueryConfig,
  type QueryPreviewResult,
  type Role,
  createChartRequestSchema,
  removeDatasetRequestSchema,
  updateChartRequestSchema,
  updateDashboardLayoutRequestSchema,
} from "@shared/index"

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api"

async function requestJson(path: string, init?: RequestInit) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  })

  const payload = (await response.json().catch(() => null)) as unknown

  if (!response.ok) {
    const message =
      typeof payload === "object" && payload && "message" in payload
        ? String((payload as { message?: unknown }).message)
        : `Request failed with status ${response.status}`

    throw new Error(message)
  }

  return payload
}

export async function fetchDatasets(): Promise<DatasetSummary[]> {
  const payload = await requestJson("/datasets")
  return datasetSummarySchema.array().parse(
    (payload as { datasets?: unknown }).datasets ?? [],
  )
}

export async function fetchDataset(datasetId: string): Promise<DatasetDetail> {
  const payload = await requestJson(`/datasets/${datasetId}`)
  return datasetDetailSchema.parse((payload as { dataset?: unknown }).dataset)
}

export async function fetchDashboards(): Promise<Dashboard[]> {
  const payload = await requestJson("/dashboards")
  return dashboardSchema.array().parse(
    (payload as { dashboards?: unknown }).dashboards ?? [],
  )
}

export async function fetchDashboard(dashboardId: string): Promise<Dashboard> {
  const payload = await requestJson(`/dashboards/${dashboardId}`)
  return dashboardSchema.parse((payload as { dashboard?: unknown }).dashboard)
}

export async function uploadDataset(input: DatasetUploadRequest): Promise<DatasetDetail> {
  const safeInput = datasetUploadRequestSchema.parse(input)
  const payload = await requestJson("/datasets/upload", {
    method: "POST",
    body: JSON.stringify(safeInput),
  })
  return datasetUploadResponseSchema.parse(payload).dataset
}

export async function deleteDataset(input: {
  datasetId: string
  role: Role
  ownerSessionId: string
}) {
  await requestJson(`/datasets/${input.datasetId}`, {
    method: "DELETE",
    body: JSON.stringify(removeDatasetRequestSchema.parse({
      role: input.role,
      ownerSessionId: input.ownerSessionId,
    })),
  })
}

export async function fetchPreview(query: QueryConfig): Promise<QueryPreviewResult> {
  const safeQuery = queryConfigSchema.parse(query)
  const payload = await requestJson("/query/preview", {
    method: "POST",
    body: JSON.stringify(safeQuery),
  })
  return queryPreviewResultSchema.parse(
    (payload as { preview?: unknown }).preview,
  )
}

export async function createChart(input: {
  dashboardId: string
  datasetId: string
  title: string
  chartType: Chart["chartType"]
  query: QueryConfig
  position: Chart["position"]
  role: Role
  ownerSessionId: string
}) {
  const payload = await requestJson("/charts", {
    method: "POST",
    body: JSON.stringify(createChartRequestSchema.parse(input)),
  })
  return chartSchema.parse((payload as { chart?: unknown }).chart)
}

export async function updateChart(input: {
  chartId: string
  title?: string
  chartType?: Chart["chartType"]
  query?: QueryConfig
  position?: Chart["position"]
  expectedVersion: number
  role: Role
  ownerSessionId: string
}) {
  const payload = await requestJson(`/charts/${input.chartId}`, {
    method: "PATCH",
    body: JSON.stringify(updateChartRequestSchema.parse(input)),
  })
  return chartSchema.parse((payload as { chart?: unknown }).chart)
}

export async function deleteChart(input: {
  chartId: string
  role: Role
  ownerSessionId: string
}) {
  await requestJson(`/charts/${input.chartId}`, {
    method: "DELETE",
    body: JSON.stringify(input),
  })
}

export async function updateDashboardLayout(input: {
  dashboardId: string
  expectedVersion: number
  role: Role
  items: Array<{
    chartId: string
    order: number
    x: number
    y: number
    width: number
    height: number
  }>
}) {
  const payload = await requestJson(`/dashboards/${input.dashboardId}/layout`, {
    method: "PATCH",
    body: JSON.stringify(updateDashboardLayoutRequestSchema.parse({
      expectedVersion: input.expectedVersion,
      role: input.role,
      items: input.items,
    })),
  })
  return dashboardSchema.parse((payload as { dashboard?: unknown }).dashboard)
}
