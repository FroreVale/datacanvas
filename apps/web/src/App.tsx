import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ModeToggle } from "@/components/mode-toggle"

function App() {
  const steps = [
    {
      title: "Upload CSV",
      description: "Register a dataset and infer its columns and types.",
      status: "P0",
    },
    {
      title: "Build a query",
      description: "Choose dimensions, metrics, and filters without SQL.",
      status: "Core",
    },
    {
      title: "Render charts",
      description: "Preview the result as charts and a compact table.",
      status: "Core",
    },
  ]

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_hsl(var(--primary)/0.12),_transparent_32%),radial-gradient(circle_at_top_right,_hsl(var(--accent)/0.1),_transparent_28%),linear-gradient(to_bottom,_transparent,_hsl(var(--muted)/0.4))]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-6 lg:px-8">
        <header className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-2">
            <Badge variant="secondary" className="w-fit">
              DataCanvas
            </Badge>
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                CSV analytics, built from the P0 upward
              </h1>
              <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
                Start with the smallest working slice: upload data, preview a
                query, and render a chart. Everything else can layer on after
                the core flow works.
              </p>
            </div>
          </div>
          <ModeToggle />
        </header>

        <main className="flex flex-1 flex-col justify-center gap-6 py-12">
          <Card className="border-border/60 bg-card/80 shadow-sm backdrop-blur">
            <CardHeader>
              <CardTitle className="text-3xl sm:text-4xl">
                Make the product real first
              </CardTitle>
              <CardDescription className="max-w-3xl text-base">
                The first milestone is a working scaffold that proves the
                project direction: one dataset, one query preview path, one
                chart surface, and one permission model placeholder.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                {steps.map((step) => (
                  <Card key={step.title} className="border-border/60">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-3">
                        <CardTitle className="text-lg">{step.title}</CardTitle>
                        <Badge variant="outline">{step.status}</Badge>
                      </div>
                      <CardDescription>{step.description}</CardDescription>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </CardContent>
            <CardFooter className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Theme support is now wired with system, light, and dark modes.
              </p>
              <Badge variant="secondary">Ready for P0 buildout</Badge>
            </CardFooter>
          </Card>
        </main>
      </div>
    </div>
  )
}

export default App
