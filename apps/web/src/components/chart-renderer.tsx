import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
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

const tooltipStyle = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "0.75rem",
  color: "var(--foreground)",
  boxShadow: "0 12px 32px rgba(0, 0, 0, 0.12)",
}

function metricKey(query: QueryConfig, index: number) {
  const metric = query.metrics[index]
  if (!metric) {
    return `value_${index}`
  }

  if (metric.alias) {
    return metric.alias
  }

  if (metric.aggregation === "count" && metric.column === "*") {
    return "count_rows"
  }

  return `${metric.aggregation}_${metric.column}`.replace(/[^a-zA-Z0-9_]/g, "_")
}

function labelKey(row: Record<string, unknown>, dimensions: string[]) {
  if (dimensions.length === 0) {
    return "__all__"
  }

  return dimensions
    .map((dimension) => String(row[dimension] ?? ""))
    .filter(Boolean)
    .join(" • ")
}

function chartRows(query: QueryConfig, preview: QueryPreviewResult) {
  const sourceRows = [...preview.rows]

  if (query.chartType === "line" && query.dimensions[0]) {
    const dimension = query.dimensions[0]
    sourceRows.sort((left, right) => {
      const leftValue = left[dimension]
      const rightValue = right[dimension]

      if (leftValue == null && rightValue == null) {
        return 0
      }
      if (leftValue == null) {
        return 1
      }
      if (rightValue == null) {
        return -1
      }

      const leftTime = Date.parse(String(leftValue))
      const rightTime = Date.parse(String(rightValue))

      if (!Number.isNaN(leftTime) && !Number.isNaN(rightTime)) {
        return leftTime - rightTime
      }

      return String(leftValue).localeCompare(String(rightValue))
    })
  }

  return sourceRows.map((row) => ({
    ...row,
    __label: labelKey(row, query.dimensions),
  }))
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
  const rows = chartRows(query, preview)
  const metricKeys = query.metrics.map((_, index) => metricKey(query, index))

  if (preview.rows.length === 0) {
    return (
      <div className="flex h-full min-h-[12rem] items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/20 text-sm text-muted-foreground">
        No rows matched this query.
      </div>
    )
  }

  if (chartType === "table") {
    return (
      <div className="w-full overflow-hidden">
        <Table className="w-full table-fixed">
          <TableHeader>
            <TableRow>
              {preview.columns.map((column) => (
                <TableHead key={column.key} className="truncate">
                  {column.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {preview.rows.map((row, index) => (
              <TableRow key={index}>
                {preview.columns.map((column) => (
                  <TableCell key={column.key} className="truncate">
                    {String(row[column.key] ?? "")}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  if (chartType === "pie") {
    const firstMetric = metricKeys[0] ?? "value_0"
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <RechartsTooltip
            contentStyle={tooltipStyle}
            labelStyle={{ color: "var(--foreground)", fontWeight: 600 }}
            itemStyle={{ color: "var(--foreground)" }}
            cursor={{ fill: "var(--muted)", opacity: 0.25 }}
          />
          <Legend />
          <Pie
            data={rows}
            dataKey={firstMetric}
            nameKey="__label"
            innerRadius={58}
            outerRadius={100}
            paddingAngle={4}
          >
            {rows.map((_, index) => (
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
        <LineChart data={rows}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="__label" tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} />
          <RechartsTooltip
            contentStyle={tooltipStyle}
            labelStyle={{ color: "var(--foreground)", fontWeight: 600 }}
            itemStyle={{ color: "var(--foreground)" }}
            cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1, opacity: 0.35 }}
          />
          <Legend />
          {metricKeys.map((metricKeyName, index) => (
            <Line
              key={metricKeyName}
              type="monotone"
              dataKey={metricKeyName}
              stroke={chartPalette[index % chartPalette.length]}
              strokeWidth={2.25}
              dot={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="__label" tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} />
        <RechartsTooltip
          contentStyle={tooltipStyle}
          labelStyle={{ color: "var(--foreground)", fontWeight: 600 }}
          itemStyle={{ color: "var(--foreground)" }}
          cursor={{ fill: "var(--muted)", opacity: 0.25 }}
        />
        <Legend />
        {metricKeys.map((metricKeyName, index) => (
          <Bar
            key={metricKeyName}
            dataKey={metricKeyName}
            fill={chartPalette[index % chartPalette.length]}
            radius={[8, 8, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}


