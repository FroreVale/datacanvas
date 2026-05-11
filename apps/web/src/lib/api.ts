import {
  datasetSummarySchema,
  queryConfigSchema,
  queryPreviewResultSchema,
  type DatasetSummary,
  type QueryConfig,
  type QueryPreviewResult,
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
  const parsed = datasetSummarySchema.array().parse(
    (payload as { datasets?: unknown }).datasets ?? [],
  )
  return parsed
}

export async function fetchPreview(query: QueryConfig): Promise<QueryPreviewResult> {
  const safeQuery = queryConfigSchema.parse(query)
  const payload = await requestJson("/query/preview", {
    method: "POST",
    body: JSON.stringify(safeQuery),
  })
  const parsed = queryPreviewResultSchema.parse(
    (payload as { preview?: unknown }).preview,
  )
  return parsed
}
