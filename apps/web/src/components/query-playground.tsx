import { type FormEvent, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { fetchDatasets, fetchPreview } from "@/lib/api"
import { cn } from "@/lib/utils"
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  aggregationSchema,
  roleSchema,
  type DatasetSummary,
  type QueryConfig,
  type Role,
} from "@shared/index"

const roleOptions: Role[] = roleSchema.options
const aggregationOptions = aggregationSchema.options

type DraftState = {
  datasetId: string
  dimension: string
  metric: string
  aggregation: (typeof aggregationOptions)[number]
  filterColumn: string
  filterOperator: "contains" | "eq"
  filterValue: string
  limit: string
  role: Role
}

function getDefaultDraft(dataset?: DatasetSummary): DraftState {
  const numericMetric = dataset?.columns.find((column) => column.type === "number")
  const dimension = dataset?.columns.find((column) => column.type === "string")?.name ?? "region"

  return {
    datasetId: dataset?.id ?? "sales-q1",
    dimension,
    metric: numericMetric?.name ?? "revenue",
    aggregation: "sum",
    filterColumn: "region",
    filterOperator: "contains",
    filterValue: "",
    limit: "10",
    role: "editor",
  }
}

function buildQuery(draft: DraftState): QueryConfig {
  const metricAlias = `${draft.aggregation}_${draft.metric}`
  const filters =
    draft.filterValue.trim().length > 0
      ? [
          {
            column: draft.filterColumn,
            operator: draft.filterOperator,
            value: draft.filterValue.trim(),
          },
        ]
      : []

  return {
    datasetId: draft.datasetId,
    dimensions: [draft.dimension],
    metrics: [
      {
        column: draft.metric,
        aggregation: draft.aggregation,
        alias: metricAlias,
      },
    ],
    filters,
    limit: Number(draft.limit) || 10,
  }
}

export function QueryPlayground() {
  const datasetsQuery = useQuery({
    queryKey: ["datasets"],
    queryFn: fetchDatasets,
  })

  const [draft, setDraft] = useState<DraftState>(() => getDefaultDraft())
  const [submittedQuery, setSubmittedQuery] = useState<QueryConfig | null>(null)

  const activeDataset = useMemo(
    () =>
      datasetsQuery.data?.find((dataset) => dataset.id === draft.datasetId) ??
      datasetsQuery.data?.[0],
    [datasetsQuery.data, draft.datasetId],
  )

  const previewQuery = useQuery({
    queryKey: ["query-preview", submittedQuery],
    queryFn: () => fetchPreview(submittedQuery as QueryConfig),
    enabled: submittedQuery !== null,
  })

  const chartKey = submittedQuery
    ? `${submittedQuery.metrics[0]?.aggregation}_${submittedQuery.metrics[0]?.column}`
    : "sum_revenue"

  const chartData = previewQuery.data?.rows ?? []

  const handleDatasetChange = (datasetId: string) => {
    const dataset = datasetsQuery.data?.find((item) => item.id === datasetId)
    setDraft((current) => ({
      ...current,
      ...getDefaultDraft(dataset),
      datasetId,
      role: current.role,
    }))
    setSubmittedQuery(null)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const query = buildQuery(draft)
    setSubmittedQuery(query)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
      <Card className="border-border/60 bg-card/80 shadow-sm backdrop-blur">
        <CardHeader>
          <CardTitle>Query builder</CardTitle>
          <CardDescription>
            A guided preview path with one dataset, one dimension, one metric,
            and one filter.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="grid gap-4">
            <label className="grid gap-2 text-sm">
              <span className="font-medium">Dataset</span>
              <Select value={draft.datasetId} onValueChange={handleDatasetChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose dataset" />
                </SelectTrigger>
                <SelectContent>
                  {datasetsQuery.data?.map((dataset) => (
                    <SelectItem key={dataset.id} value={dataset.id}>
                      {dataset.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <div className="grid gap-2">
              <span className="text-sm font-medium">Role simulation</span>
              <Select
                value={draft.role}
                onValueChange={(role) =>
                  setDraft((current) => ({ ...current, role: role as Role }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <span className="text-sm font-medium">Dimension</span>
              <Select
                value={draft.dimension}
                onValueChange={(dimension) =>
                  setDraft((current) => ({ ...current, dimension }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {activeDataset?.columns
                    .filter((column) => column.type === "string" || column.type === "date")
                    .map((column) => (
                      <SelectItem key={column.name} value={column.name}>
                        {column.label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <span className="text-sm font-medium">Metric</span>
              <Select
                value={draft.metric}
                onValueChange={(metric) =>
                  setDraft((current) => ({ ...current, metric }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {activeDataset?.columns
                    .filter((column) => column.type === "number")
                    .map((column) => (
                      <SelectItem key={column.name} value={column.name}>
                        {column.label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <span className="text-sm font-medium">Aggregation</span>
              <Select
                value={draft.aggregation}
                onValueChange={(aggregation) =>
                  setDraft((current) => ({
                    ...current,
                    aggregation: aggregation as DraftState["aggregation"],
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {aggregationOptions.map((aggregation) => (
                    <SelectItem key={aggregation} value={aggregation}>
                      {aggregation.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <span className="text-sm font-medium">Filter column</span>
              <Select
                value={draft.filterColumn}
                onValueChange={(filterColumn) =>
                  setDraft((current) => ({ ...current, filterColumn }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {activeDataset?.columns
                    .filter((column) => column.type === "string" || column.type === "date")
                    .map((column) => (
                      <SelectItem key={column.name} value={column.name}>
                        {column.label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <label className="grid gap-2 text-sm">
                <span className="font-medium">Operator</span>
                <Select
                  value={draft.filterOperator}
                  onValueChange={(filterOperator) =>
                    setDraft((current) => ({
                      ...current,
                      filterOperator: filterOperator as DraftState["filterOperator"],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contains">Contains</SelectItem>
                    <SelectItem value="eq">Equals</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label className="grid gap-2 text-sm">
                <span className="font-medium">Value</span>
                <Input
                  value={draft.filterValue}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      filterValue: event.target.value,
                    }))
                  }
                  placeholder="West"
                />
              </label>
            </div>

            <label className="grid gap-2 text-sm">
              <span className="font-medium">Limit</span>
              <Input
                type="number"
                min={1}
                max={1000}
                value={draft.limit}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    limit: event.target.value,
                  }))
                }
              />
            </label>
          </CardContent>
          <CardFooter className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Query validation and aggregation are handled on the server.
            </p>
            <button
              type="submit"
              className={cn(
                "inline-flex h-8 items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 disabled:opacity-50",
              )}
              disabled={datasetsQuery.isLoading}
            >
              Run preview
            </button>
          </CardFooter>
        </form>
      </Card>

      <div className="grid gap-6">
        <Card className="border-border/60 bg-card/80 shadow-sm backdrop-blur">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Preview</CardTitle>
              <CardDescription>
                {submittedQuery
                  ? `Dataset ${submittedQuery.datasetId} grouped by ${submittedQuery.dimensions.join(", ")}`
                  : "Submit a query to load the preview."}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">
                {activeDataset?.rowCount ?? 0} rows
              </Badge>
              <Badge variant="secondary">
                {previewQuery.data?.rowCount ?? 0} groups
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-6">
            {previewQuery.isError ? (
              <Alert variant="destructive">
                <AlertTitle>Preview failed</AlertTitle>
                <AlertDescription>
                  {(previewQuery.error as Error).message}
                </AlertDescription>
              </Alert>
            ) : null}

            <div className="min-h-[320px] rounded-xl border border-border/60 bg-background p-4">
              {previewQuery.isPending ? (
                <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
                  Loading preview...
                </div>
              ) : previewQuery.data && previewQuery.data.rows.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey={submittedQuery?.dimensions[0] ?? "__all__"}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Bar dataKey={chartKey} fill="var(--chart-1)" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
                  Run a preview to visualize the result.
                </div>
              )}
            </div>

            <div className="rounded-xl border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow>
                    {previewQuery.data?.columns.map((column) => (
                      <TableHead key={column.key}>{column.label}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewQuery.data?.rows.map((row, index) => (
                    <TableRow key={index}>
                      {previewQuery.data?.columns.map((column) => (
                        <TableCell key={column.key}>
                          {String(row[column.key] ?? "")}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
