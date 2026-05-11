import { roleSchema, type Role, type Chart } from "../../../../packages/shared/src/index.ts"

export function parseRole(value: unknown): Role {
  return roleSchema.parse(value)
}

export function canManageDatasets(role: Role) {
  return role === "admin" || role === "editor"
}

export function canCreateCharts(role: Role) {
  return role === "admin" || role === "editor"
}

export function canEditChart(role: Role, chart: Chart, ownerSessionId: string) {
  if (role === "admin") {
    return true
  }

  if (role === "editor") {
    return chart.ownerSessionId === ownerSessionId
  }

  return false
}

export function canDeleteChart(role: Role, chart: Chart, ownerSessionId: string) {
  return canEditChart(role, chart, ownerSessionId)
}

export function canUpdateLayout(role: Role) {
  return role === "admin" || role === "editor"
}
