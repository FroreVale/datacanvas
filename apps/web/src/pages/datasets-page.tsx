import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Database, FileUp, Sparkles } from "lucide-react"
import { fetchDatasets, uploadDataset } from "@/lib/api"
import { useAppStore } from "@/stores/use-app-store"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useState, type ChangeEvent } from "react"

export function DatasetsPage() {
  const queryClient = useQueryClient()
  const setActiveDatasetId = useAppStore((state) => state.setActiveDatasetId)
  const setDraftFromDataset = useAppStore((state) => state.setDraftFromDataset)
  const role = useAppStore((state) => state.role)
  const canMutate = role !== "viewer"
  const [fileName, setFileName] = useState("")
  const [csvText, setCsvText] = useState("")

  const datasetsQuery = useQuery({
    queryKey: ["datasets"],
    queryFn: fetchDatasets,
  })

  const uploadMutation = useMutation({
    mutationFn: uploadDataset,
    onSuccess: async (dataset) => {
      await queryClient.invalidateQueries({ queryKey: ["datasets"] })
      setActiveDatasetId(dataset.id)
      setDraftFromDataset(dataset)
      setFileName("")
      setCsvText("")
    },
  })

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    setFileName(file.name)
    setCsvText(await file.text())
  }

  return (
    <div className="grid gap-6">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_360px]">
        <Card className="overflow-hidden border-border/70 bg-card/85 shadow-sm backdrop-blur">
          <div className="bg-gradient-to-br from-chart-2/10 via-transparent to-primary/10">
            <CardHeader className="space-y-3">
              <Badge variant="secondary" className="w-fit">
                Datasets
              </Badge>
              <CardTitle className="text-3xl">Upload and shape the data source</CardTitle>
              <CardDescription className="max-w-2xl text-base">
                This page owns CSV intake, schema visibility, and dataset switching.
              </CardDescription>
            </CardHeader>
          </div>

          <CardContent className="grid gap-4 md:grid-cols-3">
            <InfoCard title="Rows" value={`${datasetsQuery.data?.reduce((sum, item) => sum + item.rowCount, 0) ?? 0}`} />
            <InfoCard title="Active datasets" value={`${datasetsQuery.data?.length ?? 0}`} />
            <InfoCard title="Format" value="CSV" description="Server validated" />
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/85 shadow-sm backdrop-blur">
          <CardHeader>
            <CardTitle className="text-lg">What this page owns</CardTitle>
            <CardDescription>
              Upload, inspect, and switch the active dataset before building charts.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm text-muted-foreground">
            <div className="rounded-2xl border border-border/60 bg-background/70 p-3">
              Upload a CSV to register schema metadata and row counts.
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/70 p-3">
              Click a dataset card to make it active for the builder.
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/70 p-3">
              Keep transformations on the builder page, not here.
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <Card className="border-border/70 bg-card/85 shadow-sm backdrop-blur">
          <CardHeader>
            <CardTitle>Upload CSV</CardTitle>
            <CardDescription>
              Add a dataset that the query builder can target immediately.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Input type="file" accept=".csv,text/csv" onChange={handleFile} />
            <Button
              type="button"
              className="gap-2"
              disabled={!canMutate || !csvText || uploadMutation.isPending}
              onClick={() =>
                uploadMutation.mutate({
                  filename: fileName || "upload.csv",
                  csvText,
                  role,
                  ownerSessionId: useAppStore.getState().ownerSessionId,
                })
              }
            >
              <FileUp className="size-4" />
              {uploadMutation.isPending ? "Uploading..." : "Upload dataset"}
            </Button>
            {uploadMutation.isError ? (
              <Alert variant="destructive">
                <AlertTitle>Upload failed</AlertTitle>
                <AlertDescription>{(uploadMutation.error as Error).message}</AlertDescription>
              </Alert>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/85 shadow-sm backdrop-blur">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle>Dataset library</CardTitle>
              <CardDescription>Switch the active dataset from here.</CardDescription>
            </div>
            <Badge variant="outline">{datasetsQuery.data?.length ?? 0} items</Badge>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-2xl border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Rows</TableHead>
                    <TableHead>Columns</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {datasetsQuery.data?.map((dataset) => (
                    <TableRow
                      key={dataset.id}
                      className="cursor-pointer"
                      onClick={() => {
                        setActiveDatasetId(dataset.id)
                        setDraftFromDataset(dataset)
                      }}
                    >
                      <TableCell className="font-medium">{dataset.name}</TableCell>
                      <TableCell>{dataset.rowCount}</TableCell>
                      <TableCell>{dataset.columns.length}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="gap-1">
                          <Database className="size-3" />
                          Ready
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {datasetsQuery.data?.map((dataset) => (
                <button
                  key={dataset.id}
                  type="button"
                  className="rounded-2xl border border-border/60 bg-background/70 p-4 text-left transition-colors hover:bg-accent/60"
                  onClick={() => {
                    setActiveDatasetId(dataset.id)
                    setDraftFromDataset(dataset)
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{dataset.name}</p>
                      <p className="text-xs text-muted-foreground">{dataset.rowCount} rows</p>
                    </div>
                    <Sparkles className="size-4 text-muted-foreground" />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {dataset.columns.slice(0, 4).map((column) => (
                      <Badge key={column.name} variant="outline" className="capitalize">
                        {column.label}
                      </Badge>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

function InfoCard({
  title,
  value,
  description,
}: {
  title: string
  value: string
  description?: string
}) {
  return (
    <Card className="border-border/60 bg-background/70">
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        <p className="text-3xl font-semibold tracking-tight">{value}</p>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </CardContent>
    </Card>
  )
}
