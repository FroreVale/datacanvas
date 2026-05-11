# DataCanvas Game Plan

## Goal

Build a polished CSV-powered analytics app that lets a user:

1. Upload a dataset
2. Build a query without writing SQL
3. Preview the result
4. Turn the result into a chart
5. Place charts on a dashboard
6. Switch roles to simulate permissions

The goal is not to build a full BI suite. The goal is to show strong product judgment, a clean architecture, and a working vertical slice that feels intentional.

## Product Scope

### What I will build

- CSV upload and dataset registration
- Schema inference for columns and types
- A guided query builder for dimensions, metrics, filters, and aggregation
- Server-side query execution and preview
- Charts for bar, line, pie, and table views
- Dashboard layout with reusable chart cards
- Simulated roles: admin, editor, viewer
- Optimistic updates for safe mutations like rename, move, and delete
- Query result caching

### What I will not build

- Real authentication
- Real-time collaboration
- Multiple database adapters
- Free-form SQL editing
- A complex semantic layer
- Export and sharing workflows beyond the basics

Those features are useful, but they are not the highest-value use of the time budget.

## Core Design Decision

Use a split architecture:

- Frontend owns interaction, state, and rendering
- Backend owns validation, query compilation, permissions, and dataset execution
- Metadata lives in a small SQLite store
- Analytical queries run on the server against uploaded CSV data

This keeps the UI responsive and makes the query layer deterministic and easier to reason about.

## Proposed Stack

### Frontend

- React
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- TanStack Query
- Zustand
- Recharts

### Backend

- Node.js
- TypeScript
- Fastify
- SQLite
- DuckDB
- Zod

## Why This Stack

- React + TypeScript gives a strong component model and good type safety
- TanStack Query handles server data, caching, and optimistic updates well
- Zustand is enough for local builder state without adding unnecessary complexity
- Recharts is a pragmatic choice for the chart types we need
- Fastify is lightweight and works well for typed APIs
- SQLite is enough for app metadata
- DuckDB is a good fit for local analytical query execution over CSV data
- Zod gives runtime validation for query payloads and mutations

## Data Flow

1. User uploads CSV
2. Backend stores the file and infers schema
3. Backend registers dataset metadata
4. User configures a query visually in the builder
5. Frontend sends a query config, not raw SQL
6. Backend validates the config and compiles it into SQL
7. DuckDB executes the query
8. Backend returns chart-ready rows
9. Frontend renders the result as a table or chart

## Query Model

The backend should not accept arbitrary SQL from the UI.

Instead, the frontend sends a structured query object such as:

```ts
type QueryConfig = {
  datasetId: string;
  dimensions: string[];
  metrics: Array<{
    column: string;
    aggregation: "sum" | "avg" | "count" | "min" | "max";
    alias?: string;
  }>;
  filters: Array<{
    column: string;
    operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "contains";
    value: string | number | boolean | null;
  }>;
  limit?: number;
};
```

This keeps the product safe, predictable, and easier for non-technical users.

## Permissions

Use simulated roles:

- Admin: can create, edit, and delete everything
- Editor: can create and edit their own charts
- Viewer: read-only

Permissions must be enforced in two places:

- UI disables or hides actions
- Backend rejects unauthorized requests

That way the app behaves correctly even if the UI is bypassed.

## State Management

I will split state by responsibility:

- Server state: datasets, dashboards, charts, query preview results
- Local UI state: selected chart type, active role, open modals, unsaved query drafts

TanStack Query will manage server state and invalidation.
Zustand will manage builder state and transient UI interactions.

## Performance Strategy

The app should stay responsive with 1000+ rows by:

- Running aggregation on the backend
- Returning only the rows needed for preview or chart rendering
- Caching query results using a stable cache key
- Invalidating cached results when dataset version changes
- Keeping the browser focused on rendering, not computation

## Conflict Handling

I will not implement real-time collaboration.

Instead, I will use version-based conflict detection:

- Each chart gets a `version`
- The client sends `expectedVersion` on update
- The backend rejects stale writes with `409 Conflict`

This is enough to show a realistic approach to collaborative editing without overbuilding it.

## Data Change Behavior

If a new CSV replaces the old dataset:

- Bump the dataset version
- Invalidate cached query results
- Mark dependent charts as potentially stale
- Show a clear error if a chart references missing columns

This gives a practical answer to what happens when the source data changes.

## API Shape

Likely endpoints:

- `GET /api/me`
- `POST /api/role`
- `GET /api/datasets`
- `POST /api/datasets/upload`
- `POST /api/query/preview`
- `GET /api/dashboards`
- `PATCH /api/dashboards/:id/layout`
- `POST /api/charts`
- `PATCH /api/charts/:id`
- `DELETE /api/charts/:id`
- `GET /api/charts/:id/data`

The most important endpoint is `POST /api/query/preview`, because it powers both the builder preview and the chart creation flow.

## Build Plan

### Phase 1

- Scaffold the app
- Add sample CSV data
- Create the backend metadata store
- Show a working default dashboard

### Phase 2

- Implement CSV upload
- Infer schema
- Register datasets

### Phase 3

- Implement the query builder UI
- Validate query configs
- Execute queries on the backend
- Return preview results

### Phase 4

- Add chart rendering
- Support bar, line, pie, and table
- Handle empty and error states

### Phase 5

- Add dashboard layout editing
- Add role switching
- Enforce permissions in UI and API

### Phase 6

- Add caching, optimistic updates, and conflict handling
- Polish loading states and empty states
- Write the README tradeoff sections

## Final README Positioning

The final README for the project should explain:

- Why CSV was chosen over more complex data sources
- Why query execution happens on the backend
- Why the query builder is guided instead of SQL-based
- How permissions work
- How caching and invalidation work
- What the app does not solve
- What I would build next with more time

## Working Assumptions

- The evaluator cares more about a polished vertical slice than breadth
- CSV upload is the easiest path for review and demo
- A strong README matters as much as code
- Showing good tradeoffs is more important than maximizing feature count

## Next Step

Create the app skeleton, add the sample data, and implement the dataset + query preview path first. That is the shortest route to a demonstrable product.
