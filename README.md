# DataCanvas

DataCanvas is a CSV-powered analytics app. The user can upload a CSV, pick a dataset, choose dimensions and metrics, add filters, preview the result, and save it as a chart. The app also supports simple admin, editor, and viewer roles.

## Overview

This is a guided analytics workflow, not a raw SQL tool.

What the user can do in the app:

- Upload CSV files
- Detect columns and column types
- Build queries with dimensions, metrics, filters, and aggregation
- Preview results before saving a chart
- Save charts to a dashboard
- Open saved charts again from the charts page
- Switch roles to test permissions
- Delete charts and datasets as an admin

## Setup

### Requirements

- Node.js 20+
- `pnpm` 10+

### Install

```bash
git clone <your-repo-url>
cd datacanvas
pnpm install
```

### Run locally

Open two terminals:

```bash
pnpm dev:api
```

```bash
pnpm dev:web
```

Then open:

```txt
http://127.0.0.1:5173
```

The web app proxies `/api` requests to the backend, so no separate frontend env file is needed for normal local testing.

### First run

- The app seeds sample data automatically.
- The user sees a dashboard, datasets, and charts right away.
- The query builder is ready to use immediately.

### Optional checks

```bash
pnpm typecheck:api
pnpm typecheck:web
pnpm build:api
pnpm build:web
```

## Tech Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query, Zustand, Recharts
- Backend: Node.js, TypeScript, Fastify, SQLite, DuckDB, Zod
- Shared: runtime schemas and shared types in `packages/shared`

## Why These Choices

- React and TypeScript fit the assignment well because the UI is stateful and the app benefits from typed data models.
- Vite keeps local development simple and fast.
- Tailwind CSS and shadcn/ui make it easier to build a clean interface without spending too much time on custom styling.
- TanStack Query fits the app because the main data is server state: datasets, dashboards, charts, and previews.
- Zustand fits the app because the builder needs a small amount of local UI state that should stay separate from server data.
- Recharts is a good fit because the required chart types are simple and it works well with React.
- Fastify is a good backend choice here because it is lightweight, easy to type, and simple to keep organized.
- SQLite is a good choice for app metadata because this is a take-home app, not a production warehouse. It keeps the setup simple and still gives persistence for datasets, dashboards, and charts.
- DuckDB is used for query execution because it is built for analytical SQL over CSV data and works well for grouped previews.
- Zod is used because it validates requests at runtime and keeps the frontend and backend data shapes aligned.

## Architecture and Design Decisions

### Frontend

- `apps/web` is the UI.
- TanStack Query owns server data, previews, and mutations.
- Zustand owns local state like the active dataset, role, and draft query state.
- Recharts renders bar, line, pie, and table views.
- shadcn/ui gives me the base UI components.

### Backend

- `apps/api` exposes JSON endpoints for datasets, dashboards, charts, and query previews.
- CSV files are stored on disk.
- Dataset metadata is stored in SQLite.
- Query previews run on the server with DuckDB.
- Query results are cached in memory by dataset version and query config.

### Shared contracts

`packages/shared` holds the runtime schemas and shared types for both the frontend and backend. This keeps the API and UI in sync.

### Query model

The browser does not send raw SQL. It sends a structured query object:

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

The backend validates this object, converts it into SQL, and runs it with DuckDB.

## Data Flow

1. A CSV is loaded or uploaded.
2. The backend stores the file and infers the schema.
3. A query is built with the builder UI.
4. The backend validates the query against the dataset.
5. DuckDB runs the preview on the server.
6. The frontend shows the returned rows as a table or chart.
7. The chart is saved to the dashboard.
8. Saved charts can be opened again from the charts page.

## Query Builder Design

The builder stays guided so it works for non-technical users.

The controls are:

- Dataset
- Chart type
- Dimensions
- Metrics
- Filters
- Limit
- Preview

The important rules are:

- Metrics are based on numeric columns, plus `COUNT rows`.
- Pie charts use one dimension and one metric.
- Bar charts use one dimension and one metric.
- Line charts use one ordered dimension and one metric.
- Filters are applied before the chart is built.

This keeps the query builder simple and predictable.

## API Design

The main endpoints are:

```txt
GET    /api/datasets
POST   /api/datasets/upload
GET    /api/datasets/:datasetId
DELETE /api/datasets/:datasetId

GET    /api/dashboards
GET    /api/dashboards/:dashboardId
POST   /api/charts
GET    /api/charts/:chartId
PATCH  /api/charts/:chartId
DELETE /api/charts/:chartId

POST   /api/query/preview
```

What the preview returns:

```json
{
  "rows": [],
  "columns": [],
  "rowCount": 0,
  "executionMs": 0,
  "cached": false
}
```

The preview response is meant to work for both charts and tables.

## State Management

State is split into two parts:

- TanStack Query handles server state like datasets, dashboards, charts, and previews
- Zustand handles local UI state like the active dataset, active dashboard, role, and draft query state

This split keeps temporary UI state separate from cached server data.

## Data Models

App data is stored in SQLite.

Important records:

- Dataset
- Dashboard
- Chart

Each chart stores:

- dashboardId
- datasetId
- title
- chartType
- query
- position
- version
- ownerSessionId

## Permission System

The app simulates three roles:

- Admin: can create, edit, and delete everything
- Editor: can create charts and edit their own charts
- Viewer: read-only

This is enforced in both places:

- The UI hides or disables actions
- The API rejects unauthorized writes

## Performance Optimizations

The app uses a few choices to stay fast:

- Query previews run on the backend, not in the browser
- Preview results are cached by dataset version and query config
- Only chart-ready rows are sent back to the UI
- Dataset version changes invalidate stale previews
- The app seeds sample data so the first screen is immediately usable

## Handling Data Changes

The app uses simple behavior for data changes:

- If a chart is deleted, it disappears from the dashboard.
- If a dataset is deleted, the charts that depend on it are also deleted.
- If a chart no longer matches the dataset, the API returns a validation error.

This keeps the app predictable and avoids orphaned charts.

## Error Recovery

If a preview fails, the UI shows the error.

If a query is invalid, the preview is blocked before it can run.

If a user tries to edit something with the wrong role or version, the API rejects it.

## Collaborative Editing / Conflicts

Version checks are used for chart edits and dashboard updates.

If two people save at the same time:

- the first save wins
- the second save gets a conflict error

This is simpler than real-time collaboration and still shows safe update handling.

## Tradeoffs

- CSV upload is used because it is the easiest way to test the full flow.
- A guided query builder is used instead of a raw SQL editor.
- Query previews run on the backend so the browser does not do heavy work.
- The dashboard stays as a compact chart canvas instead of a complex drag-and-drop editor.
- The chart types are limited so the main flow stays clear.

## Future Work

- Add better chart editing
- Add more dataset replacement flows
- Add more chart types
- Add export for charts
- Add stronger dashboard layout editing for a fuller builder

## Demo Flow

1. Open the app.
2. Switch roles.
3. Upload a CSV.
4. Build a query.
5. Preview the result.
6. Save the chart.
7. Open the dashboard.
8. Open a saved chart again from the charts page.
9. Delete charts or datasets as an admin.
