import { useQuery } from "@tanstack/react-query"
import { MoreHorizontal, Trash2 } from "lucide-react"
import { fetchPreview } from "@/lib/api"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ChartRenderer } from "@/components/chart-renderer"
import type { Chart, Role } from "@shared/index"

export function ChartCard({
  chart,
  datasetName,
  role,
  ownerSessionId,
  onDelete,
  className,
}: {
  chart: Chart
  datasetName?: string
  role: Role
  ownerSessionId: string
  onDelete?: (chartId: string) => void
  className?: string
}) {
  const previewQuery = useQuery({
    queryKey: ["chart-preview", chart.id, chart.version],
    queryFn: () => fetchPreview(chart.query),
    staleTime: 30_000,
  })

  const canEdit = role === "admin" || (role === "editor" && chart.ownerSessionId === ownerSessionId)

  return (
    <Card
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden border-border/70 bg-card/80 shadow-sm backdrop-blur",
        className,
      )}
    >
      <CardHeader className="flex shrink-0 flex-row flex-wrap items-start justify-between gap-3 pb-3">
        <div className="min-w-0 space-y-1">
          <CardTitle className="truncate text-lg">{chart.title}</CardTitle>
          <CardDescription className="truncate text-sm">
            {datasetName ?? chart.datasetId} - {chart.chartType.toUpperCase()}
          </CardDescription>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="outline">v{chart.version}</Badge>
          <Badge variant="secondary" className="capitalize">
            {chart.chartType}
          </Badge>
          {onDelete ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="icon-sm" className="shrink-0">
                  <MoreHorizontal />
                  <span className="sr-only">Chart actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  disabled={!canEdit}
                  onClick={() => onDelete(chart.id)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 />
                  Delete chart
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="min-h-0 flex-1 overflow-hidden">
        {previewQuery.isPending ? (
          <div className="flex h-full min-h-[12rem] items-center justify-center">
            <Skeleton className="h-8 w-32" />
          </div>
        ) : previewQuery.isError ? (
          <Alert variant="destructive">
            <AlertTitle>Preview failed</AlertTitle>
            <AlertDescription>{(previewQuery.error as Error).message}</AlertDescription>
          </Alert>
        ) : previewQuery.data ? (
          <div className="h-full min-h-[12rem] overflow-hidden rounded-2xl border border-border/60 bg-background/70 p-3">
            <ChartRenderer
              chartType={chart.chartType}
              query={chart.query}
              preview={previewQuery.data}
            />
          </div>
        ) : null}
      </CardContent>

      <CardFooter className="shrink-0 justify-between text-xs text-muted-foreground">
        <span>{previewQuery.data?.rowCount ?? 0} grouped rows</span>
        <span>{previewQuery.data?.cached ? "cached" : "fresh"}</span>
      </CardFooter>
    </Card>
  )
}
