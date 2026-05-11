import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts"
import { type ChartType, type QueryConfig, type QueryPreviewResult } from "@shared/index"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const chartPalette = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]

function metricKey(query: QueryConfig) {
  const metric = query.metrics[0]
  if (!metric) {
    return "value"
  }

  return metric.alias || `${metric.aggregation}_${metric.column}`.replace(/[^a-zA-Z0-9_]/g, "_")
}

function labelKey(query: QueryConfig) {
  return query.dimensions[0] ?? "__all__"
}

export function ChartRenderer({
  chartType,
  query,
  preview,
}: {
  chartType: ChartType
  query: QueryConfig
  preview: QueryPreviewResult
}) {
  const dataKey = metricKey(query)
  const xKey = labelKey(query)

  if (preview.rows.length === 0) {
    return (
      <div className="flex h-full min-h-[12rem] items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/20 text-sm text-muted-foreground">
        No rows matched this query.
      </div>
    )
  }

  if (chartType === "table") {
    return (
      <div className="overflow-hidden rounded-xl border border-border/60">
        <Table>
          <TableHeader>
            <TableRow>
              {preview.columns.map((column) => (
                <TableHead key={column.key}>{column.label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {preview.rows.slice(0, 8).map((row, index) => (
              <TableRow key={index}>
                {preview.columns.map((column) => (
                  <TableCell key={column.key}>{String(row[column.key] ?? "")}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  if (chartType === "pie") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <RechartsTooltip />
          <Pie
            data={preview.rows}
            dataKey={dataKey}
            nameKey={xKey}
            innerRadius={58}
            outerRadius={100}
            paddingAngle={4}
          >
            {preview.rows.map((_, index) => (
              <Cell key={index} fill={chartPalette[index % chartPalette.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    )
  }

  if (chartType === "line") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={preview.rows}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey={xKey} tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} />
          <RechartsTooltip />
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke="var(--chart-2)"
            strokeWidth={2.25}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={preview.rows}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey={xKey} tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} />
        <RechartsTooltip />
        <Bar dataKey={dataKey} fill="var(--chart-1)" radius={[8, 8, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
