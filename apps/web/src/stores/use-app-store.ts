import { create } from "zustand"
import {
  roleSchema,
  type Aggregation,
  type ChartType,
  type DatasetSummary,
  type FilterOperator,
  type Role,
  type TableMode,
} from "@shared/index"
import {
  COUNT_ROWS_METRIC,
  getDefaultAggregation,
  getDefaultDimension,
  getDefaultMetric,
  getDefaultTableColumns,
  getDefaultTableMode,
} from "@/lib/chart-builder"

const storageKey = "datacanvas-session"
const roleKey = "datacanvas-role"

function getInitialSessionId() {
  if (typeof window === "undefined") {
    return "server-session"
  }

  const existing = window.localStorage.getItem(storageKey)
  if (existing) {
    return existing
  }

  const sessionId = window.crypto.randomUUID()
  window.localStorage.setItem(storageKey, sessionId)
  return sessionId
}

function getInitialRole(): Role {
  if (typeof window === "undefined") {
    return "editor"
  }

  const stored = window.localStorage.getItem(roleKey)
  if (stored && roleSchema.safeParse(stored).success) {
    return stored as Role
  }

  window.localStorage.setItem(roleKey, "editor")
  return "editor"
}

export type BuilderDraft = {
  chartTitle: string
  chartType: ChartType
  tableMode: TableMode
  tableColumns: string[]
  dimension: string
  metric: string
  aggregation: Aggregation
  filterColumn: string
  filterOperator: FilterOperator
  filterValue: string
  limit: number
}

type AppStore = {
  role: Role
  ownerSessionId: string
  activeDashboardId: string | null
  activeDatasetId: string | null
  draft: BuilderDraft
  setRole: (role: Role) => void
  setOwnerSessionId: (sessionId: string) => void
  setActiveDashboardId: (dashboardId: string | null) => void
  setActiveDatasetId: (datasetId: string | null) => void
  setDraft: (draft: Partial<BuilderDraft>) => void
  setDraftFromDataset: (dataset?: DatasetSummary) => void
}

function defaultDraft(dataset?: DatasetSummary): BuilderDraft {
  const dimension = getDefaultDimension(dataset, "bar")
  const metric = getDefaultMetric(dataset)

  return {
    chartTitle: metric === COUNT_ROWS_METRIC ? "Count by Product" : "Revenue by Product",
    chartType: "bar",
    tableMode: getDefaultTableMode(),
    tableColumns: getDefaultTableColumns(dataset),
    dimension,
    metric,
    aggregation: getDefaultAggregation(metric),
    filterColumn: dataset?.columns[0]?.name ?? "region",
    filterOperator: "contains",
    filterValue: "",
    limit: 20,
  }
}

export const useAppStore = create<AppStore>((set, get) => ({
  role: getInitialRole(),
  ownerSessionId: getInitialSessionId(),
  activeDashboardId: null,
  activeDatasetId: null,
  draft: defaultDraft(),
  setRole: (role) => {
    set({ role: roleSchema.parse(role) })
    if (typeof window !== "undefined") {
      window.localStorage.setItem(roleKey, role)
    }
  },
  setOwnerSessionId: (sessionId) => {
    set({ ownerSessionId: sessionId })
    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, sessionId)
    }
  },
  setActiveDashboardId: (activeDashboardId) => set({ activeDashboardId }),
  setActiveDatasetId: (activeDatasetId) => set({ activeDatasetId }),
  setDraft: (draft) => {
    set({ draft: { ...get().draft, ...draft } })
  },
  setDraftFromDataset: (dataset) => {
    const nextDraft = defaultDraft(dataset)
    set((state) => ({
      draft: {
        ...nextDraft,
        chartType: state.draft.chartType,
        tableMode: state.draft.tableMode,
      },
      activeDatasetId: dataset?.id ?? state.activeDatasetId,
    }))
  },
}))
