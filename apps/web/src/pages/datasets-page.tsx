import { useRef, useState, type ChangeEvent } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Database, Plus } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { deleteDataset, fetchDatasets, uploadDataset } from "@/lib/api"
import { useAppStore } from "@/stores/use-app-store"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export function DatasetsPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const setActiveDatasetId = useAppStore((state) => state.setActiveDatasetId)
  const setDraftFromDataset = useAppStore((state) => state.setDraftFromDataset)
  const role = useAppStore((state) => state.role)
  const ownerSessionId = useAppStore((state) => state.ownerSessionId)
  const canMutate = role !== "viewer"
  const canDelete = role === "admin"
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [fileName, setFileName] = useState("")

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
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteDataset,
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["datasets"] })
      await queryClient.invalidateQueries({ queryKey: ["dashboards"] })

      const remaining = datasetsQuery.data?.filter((dataset) => dataset.id !== variables.datasetId) ?? []
      const nextDataset = remaining[0]
      if (nextDataset) {
        setActiveDatasetId(nextDataset.id)
        setDraftFromDataset(nextDataset)
      } else {
        setActiveDatasetId(null)
        setDraftFromDataset(undefined)
      }
    },
  })

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    setFileName(file.name)
    const text = await file.text()

    uploadMutation.mutate({
      filename: file.name,
      csvText: text,
      role,
      ownerSessionId,
    })
  }

  return (
    <div className="grid gap-6">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Datasets</h1>
          <p className="text-sm text-muted-foreground">Upload a CSV or pick an existing dataset.</p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline">{datasetsQuery.data?.length ?? 0} items</Badge>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleFile}
          />
          <Button
            type="button"
            className="gap-2"
            disabled={!canMutate || uploadMutation.isPending}
            onClick={() => fileInputRef.current?.click()}
          >
            <Plus className="size-4" />
            New dataset
          </Button>
        </div>
      </section>

      {uploadMutation.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Upload failed</AlertTitle>
          <AlertDescription>{(uploadMutation.error as Error).message}</AlertDescription>
        </Alert>
      ) : null}

      {fileName && uploadMutation.isPending ? (
        <div className="text-sm text-muted-foreground">
          Uploading {fileName}...
        </div>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-border/60">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Rows</TableHead>
              <TableHead>Columns</TableHead>
              <TableHead>Status</TableHead>
              {canDelete ? <TableHead className="w-24 text-right">Actions</TableHead> : null}
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
                  navigate("/builder")
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
                {canDelete ? (
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-8 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      disabled={deleteMutation.isPending}
                      onClick={(event) => {
                        event.stopPropagation()
                        deleteMutation.mutate({
                          datasetId: dataset.id,
                          role,
                          ownerSessionId,
                        })
                      }}
                    >
                      Delete
                    </Button>
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </div>
  )
}
