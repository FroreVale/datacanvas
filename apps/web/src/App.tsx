import { ModeToggle } from "@/components/mode-toggle"
import { QueryPlayground } from "@/components/query-playground"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

function App() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_hsl(var(--primary)/0.12),_transparent_32%),radial-gradient(circle_at_top_right,_hsl(var(--accent)/0.1),_transparent_28%),linear-gradient(to_bottom,_transparent,_hsl(var(--muted)/0.4))]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-2">
            <Badge variant="secondary" className="w-fit">
              DataCanvas
            </Badge>
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                CSV analytics, built from the P0 upward
              </h1>
              <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
                The first working slice is here: seeded data, validated query
                preview, cached fetches, and a basic chart/table result.
              </p>
            </div>
          </div>
          <ModeToggle />
        </header>

        <main className="flex flex-1 flex-col gap-6 py-12">
          <Card className="border-border/60 bg-card/80 shadow-sm backdrop-blur">
            <CardHeader>
              <CardTitle className="text-3xl sm:text-4xl">
                Make the product real first
              </CardTitle>
              <CardDescription className="max-w-3xl text-base">
                This slice proves the data flow end-to-end before we add CSV
                upload, persistence, dashboard editing, or permissions
                enforcement.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <Card className="border-border/60">
                  <CardHeader>
                    <CardTitle className="text-lg">Shared contracts</CardTitle>
                    <CardDescription>
                      Zod schemas and types keep the frontend and backend in
                      sync.
                    </CardDescription>
                  </CardHeader>
                </Card>
                <Card className="border-border/60">
                  <CardHeader>
                    <CardTitle className="text-lg">Query preview</CardTitle>
                    <CardDescription>
                      A structured query config is validated server-side and
                      executed against seeded data.
                    </CardDescription>
                  </CardHeader>
                </Card>
                <Card className="border-border/60">
                  <CardHeader>
                    <CardTitle className="text-lg">Chart + table</CardTitle>
                    <CardDescription>
                      The returned rows are rendered as a bar chart and a data
                      table.
                    </CardDescription>
                  </CardHeader>
                </Card>
              </div>
            </CardContent>
          </Card>

          <QueryPlayground />
        </main>
      </div>
    </div>
  )
}

export default App
