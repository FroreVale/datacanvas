# DataCanvas

DataCanvas is a CSV-powered analytics workspace for building charts and dashboards without writing SQL. The app opens to a seeded dashboard, supports CSV upload, infers dataset schema, validates guided query configs, executes query previews on the server, and lets you save charts onto a dashboard while simulating admin, editor, and viewer roles.

## Overview

The product is intentionally scoped as a vertical slice:

- Upload a CSV
- Detect columns and types
- Build a query with dimensions, metrics, filters, and aggregation
- Preview the result server-side
- Save the query as a chart
- Show charts on a dashboard grid
- Switch roles to see permissions change

The goal is not to build a full BI suite. The goal is to demonstrate strong product judgment, clean architecture, and a polished working slice.

## Tech Stack

- Frontend: Vite, React, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query, Zustand, Recharts
- Backend: Node.js, TypeScript, Fastify, SQLite, Zod
- Shared: strict Zod schemas and TypeScript types in `packages/shared`

## Architecture

### Frontend

- `apps/web` renders the dashboard workspace
- TanStack Query owns datasets, dashboards, previews, and mutations
- Zustand owns transient builder state, role simulation, and the active dashboard/dataset
- Recharts renders bar, line, and pie charts
- shadcn/ui provides the shell, cards, buttons, inputs, selects, tables, alerts, and badges

### Backend

- `apps/api` exposes JSON endpoints for datasets, dashboards, query previews, and chart/layout mutations
- Uploaded CSVs are stored on disk under `apps/api/uploads`
- Dataset metadata lives in SQLite under `apps/api/dev.db`
- CSV schema inference happens server-side
- Query preview is compiled from a safe structured query model into SQL and executed against an in-memory query table
- Query previews are cached in memory by dataset version and query config

### Shared contracts

`packages/shared` defines the runtime schemas for:

- roles
- dataset summaries and details
- query config
- preview payloads
- charts
- dashboard layout
- upload and mutation requests

The UI and API both validate against the same DTOs so the contract does not drift.

## Data Flow

1. The app loads a seeded dashboard and dataset.
2. The user can upload a CSV.
3. The backend stores the file, infers schema, and persists dataset metadata.
4. The query builder creates a structured `QueryConfig`.
5. The backend validates the config against the dataset schema.
6. The backend compiles SQL and runs the preview server-side.
7. The frontend renders the returned rows as a chart and table.
8. Saving a chart persists it to SQLite metadata and shows it on the dashboard.

## Query Model

The UI never sends raw SQL. It sends a structured query object:

```ts
type QueryConfig = {
  datasetId: string
  dimensions: string[]
  metrics: Array<{
    column: string
    aggregation: "sum" | "avg" | "count" | "min" | "max"
    alias?: string
  }>
  filters: Array<{
    column: string
    operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "contains"
    value: string | number | boolean | null
  }>
  limit?: number
}
```

This keeps the interaction guided for non-technical users and keeps the backend deterministic and safe.

## Permission System

Roles are simulated, not authenticated:

- Admin: can create and edit everything
- Editor: can create charts and edit their own charts
- Viewer: read-only

Permissions are enforced in both places:

- The UI disables or hides actions
- The API rejects unauthorized mutations

## Performance Strategy

- Query previews run on the server, not in React
- Query results are cached in memory by dataset version and query config
- Only chart-ready rows are sent back to the browser
- Dataset versions are preserved so stale results can be invalidated cleanly

## Handling Data Changes

- Uploaded datasets receive a new metadata record
- Seeded datasets live on disk and are read from the server
- Chart previews are re-run from the current dataset state
- If a chart references a missing column, the API returns a validation error

## Conflict Handling

The app uses version-based conflict checks for charts and dashboard layout updates:

- each mutation includes an expected version
- the API compares that version to the current record
- stale writes return a conflict error

This keeps the implementation simple while still demonstrating safe concurrent editing behavior.

## Demo Flow

1. Open the app and see the seeded dashboard
2. Switch roles in the builder
3. Upload a CSV
4. Choose a dataset, dimension, metric, aggregation, filter, and chart type
5. Preview the result
6. Save the chart
7. See it appear on the dashboard
8. Adjust the layout controls

## Local Setup

The workspace is already configured as a monorepo. The common checks are:

- `apps/api`: typecheck and run the Fastify server
- `apps/web`: typecheck and run the Vite app

If you need to run the exact checks in this environment, use the local TypeScript and Vite binaries under `node_modules/.pnpm`.

## Tradeoffs

- I kept the data model strict and structured so the frontend and backend stay in sync.
- I chose CSV upload as the primary data source because it is the fastest deterministic review path.
- I prioritized a dashboard-first product surface over adding extra BI features.
- I kept the chart layout controls simple and explicit so the behavior is easy to explain and verify.

## What I Would Extend Next

- Swap the query engine to DuckDB when the dependency/runtime is available
- Add fuller drag-and-drop dashboard editing
- Add chart editing modals and stronger optimistic updates
- Add more robust dataset replacement and stale-chart recovery flows

## Time Breakdown

- Foundation and shared contracts: initial build
- Dashboard shell and theme: initial build
- CSV upload, query engine, persistence, and dashboard flow: current refactor
- README and verification: current refactor

