import { z } from "zod"

export const roleSchema = z.enum(["admin", "editor", "viewer"])
export type Role = z.infer<typeof roleSchema>

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
})
export type DatasetColumn = z.infer<typeof datasetColumnSchema>

export const datasetSummarySchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  version: z.number().int().positive(),
  rowCount: z.number().int().nonnegative(),
  columns: z.array(datasetColumnSchema),
})
export type DatasetSummary = z.infer<typeof datasetSummarySchema>

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
