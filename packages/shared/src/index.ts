import { z } from "zod"

export const roleSchema = z.enum(["admin", "editor", "viewer"])
export type Role = z.infer<typeof roleSchema>

export const datasetSourceKindSchema = z.enum(["upload", "seed"])
export type DatasetSourceKind = z.infer<typeof datasetSourceKindSchema>

export const datasetColumnTypeSchema = z.enum([
  "string",
  "number",
  "date",
  "boolean",
])
export type DatasetColumnType = z.infer<typeof datasetColumnTypeSchema>

export const datasetColumnSchema = z.strictObject({
  name: z.string().min(1),
  label: z.string().min(1),
  type: datasetColumnTypeSchema,
  nullable: z.boolean(),
})
export type DatasetColumn = z.infer<typeof datasetColumnSchema>

export const datasetSummarySchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  sourceFilename: z.string().min(1),
  sourceKind: datasetSourceKindSchema,
  version: z.number().int().positive(),
  rowCount: z.number().int().nonnegative(),
  columns: z.array(datasetColumnSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export type DatasetSummary = z.infer<typeof datasetSummarySchema>

export const datasetDetailSchema = datasetSummarySchema
export type DatasetDetail = z.infer<typeof datasetDetailSchema>

export const chartTypeSchema = z.enum(["bar", "line", "pie", "table"])
export type ChartType = z.infer<typeof chartTypeSchema>

export const aggregationSchema = z.enum([
  "sum",
  "avg",
  "count",
  "min",
  "max",
])
export type Aggregation = z.infer<typeof aggregationSchema>

export const filterOperatorSchema = z.enum([
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "contains",
])
export type FilterOperator = z.infer<typeof filterOperatorSchema>

export const queryValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
])
export type QueryValue = z.infer<typeof queryValueSchema>

export const queryFilterSchema = z.strictObject({
  column: z.string().min(1),
  operator: filterOperatorSchema,
  value: queryValueSchema,
})
export type QueryFilter = z.infer<typeof queryFilterSchema>

export const queryMetricSchema = z.strictObject({
  column: z.string().min(1),
  aggregation: aggregationSchema,
  alias: z.string().min(1).optional(),
})
export type QueryMetric = z.infer<typeof queryMetricSchema>

export const queryConfigSchema = z.strictObject({
  datasetId: z.string().min(1),
  dimensions: z.array(z.string().min(1)).default([]),
  metrics: z.array(queryMetricSchema).min(1),
  filters: z.array(queryFilterSchema).default([]),
  limit: z.number().int().positive().max(1000).optional(),
})
export type QueryConfig = z.infer<typeof queryConfigSchema>

export const previewColumnSchema = z.strictObject({
  key: z.string().min(1),
  label: z.string().min(1),
})
export type PreviewColumn = z.infer<typeof previewColumnSchema>

export const queryPreviewResultSchema = z.strictObject({
  dataset: datasetSummarySchema,
  rowCount: z.number().int().nonnegative(),
  rows: z.array(z.record(z.string(), queryValueSchema)),
  columns: z.array(previewColumnSchema),
  generatedAt: z.string().datetime(),
  cached: z.boolean(),
  executionMs: z.number().nonnegative(),
})
export type QueryPreviewResult = z.infer<typeof queryPreviewResultSchema>

export const queryPreviewErrorSchema = z.strictObject({
  message: z.string().min(1),
  issues: z.array(
    z.strictObject({
      path: z.array(z.union([z.string(), z.number()])),
      message: z.string().min(1),
    }),
  ),
})
export type QueryPreviewError = z.infer<typeof queryPreviewErrorSchema>

export const chartPositionSchema = z.strictObject({
  order: z.number().int().nonnegative(),
  width: z.number().int().positive().max(12),
  height: z.number().int().positive().max(12),
})
export type ChartPosition = z.infer<typeof chartPositionSchema>

export const chartSchema = z.strictObject({
  id: z.string().min(1),
  dashboardId: z.string().min(1),
  datasetId: z.string().min(1),
  title: z.string().min(1),
  chartType: chartTypeSchema,
  query: queryConfigSchema,
  position: chartPositionSchema,
  version: z.number().int().positive(),
  ownerSessionId: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export type Chart = z.infer<typeof chartSchema>

export const dashboardSchema = z.strictObject({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  version: z.number().int().positive(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  charts: z.array(chartSchema),
})
export type Dashboard = z.infer<typeof dashboardSchema>

export const datasetUploadRequestSchema = z.strictObject({
  filename: z.string().min(1),
  csvText: z.string().min(1),
  role: roleSchema.optional(),
  ownerSessionId: z.string().min(1).optional(),
})
export type DatasetUploadRequest = z.infer<typeof datasetUploadRequestSchema>

export const datasetUploadResponseSchema = z.strictObject({
  dataset: datasetDetailSchema,
  dashboard: dashboardSchema.optional(),
})
export type DatasetUploadResponse = z.infer<typeof datasetUploadResponseSchema>

export const createChartRequestSchema = z.strictObject({
  dashboardId: z.string().min(1),
  datasetId: z.string().min(1),
  title: z.string().min(1),
  chartType: chartTypeSchema,
  query: queryConfigSchema,
  position: chartPositionSchema,
  role: roleSchema,
  ownerSessionId: z.string().min(1),
})
export type CreateChartRequest = z.infer<typeof createChartRequestSchema>

export const updateChartRequestSchema = z.strictObject({
  title: z.string().min(1).optional(),
  chartType: chartTypeSchema.optional(),
  query: queryConfigSchema.optional(),
  position: chartPositionSchema.optional(),
  expectedVersion: z.number().int().positive(),
  role: roleSchema,
  ownerSessionId: z.string().min(1),
})
export type UpdateChartRequest = z.infer<typeof updateChartRequestSchema>

export const updateDashboardLayoutItemSchema = z.strictObject({
  chartId: z.string().min(1),
  order: z.number().int().nonnegative(),
  width: z.number().int().positive().max(12),
  height: z.number().int().positive().max(12),
})
export type UpdateDashboardLayoutItem = z.infer<
  typeof updateDashboardLayoutItemSchema
>

export const updateDashboardLayoutRequestSchema = z.strictObject({
  expectedVersion: z.number().int().positive(),
  role: roleSchema,
  items: z.array(updateDashboardLayoutItemSchema),
})
export type UpdateDashboardLayoutRequest = z.infer<
  typeof updateDashboardLayoutRequestSchema
>

export const removeChartRequestSchema = z.strictObject({
  role: roleSchema,
  ownerSessionId: z.string().min(1),
})
export type RemoveChartRequest = z.infer<typeof removeChartRequestSchema>

