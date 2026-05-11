# Stack Docs Reference

This file is the working reference for the DataCanvas stack. Before implementing a feature, read the relevant official docs for the tools involved and use this file to keep the architecture consistent.

## Product Direction

- Build a CSV-first analytics app.
- Keep query building guided, not SQL-based.
- Execute data transformation on the backend.
- Use a small local database for metadata and app state.
- Render charts from chart-ready rows, not raw SQL output.
- Simulate roles instead of adding real authentication.

## What Goes Where

- `apps/web`:
  - React UI
  - Query builder controls
  - Dashboard layout and chart rendering
  - Local interaction state
  - Server-state fetching and caching
- `apps/api`:
  - HTTP API
  - Request validation
  - Dataset registration
  - Query preview execution
  - Permission checks
  - Conflict/version checks
- `packages/shared`:
  - Shared Zod schemas
  - Shared TypeScript types
  - Cross-package constants and enums

## Docs-Backed Rules By Tool

### React

- Use React for component-driven UI and stateful views.
- Prefer functional components and hooks.
- Keep the UI simple to reason about and split by responsibility.

Source:
- [React components](https://react.dev/reference/react/components)
- [React hooks](https://react.dev/reference/react/hooks)

### Vite

- Vite is the frontend build tool and dev server.
- It provides HMR and builds production assets.
- Vite transpiles TypeScript, but type checking still needs the TypeScript build step.

Use Vite for:
- app startup
- local dev
- production bundling

Source:
- [Vite Getting Started](https://vite.dev/guide/)
- [Vite Features](https://vite.dev/guide/features.html)

### TanStack Query

- Use TanStack Query for server state, not for local UI state.
- Good fits here are datasets, dashboards, query previews, chart data, and mutations that need caching or invalidation.
- Query invalidation should happen when dataset versions or chart versions change.
- Use mutations for create/update/delete flows and optimistic updates where it is safe.

Source:
- [TanStack Query React overview](https://tanstack.com/query/query/latest/docs/framework/react/react/overview)
- [TanStack React docs](https://tanstack.com/query/latest/docs/react/)

### Zustand

- Use Zustand for local UI state and builder state.
- Keep transient state here: active role, selected chart type, query draft controls, modal state, filters in progress.
- Do not move server state into Zustand unless there is a clear reason.
- Zustand stores are hook-based and lightweight, which keeps component wiring simple.
- In TypeScript, define the store type explicitly with `create<T>()(...)` when needed.

Source:
- [Zustand introduction](https://zustand.docs.pmnd.rs/getting-started/introduction)
- [Zustand TypeScript guide](https://zustand.docs.pmnd.rs/learn/guides/beginner-typescript)
- [Zustand advanced TypeScript guide](https://zustand.docs.pmnd.rs/learn/guides/advanced-typescript)

### Fastify

- Use Fastify for the API server.
- Treat route schemas as application code.
- Validate input at the API boundary before any database or query work.
- Prefer schema-based validation and serialization.
- Use Fastify hooks for work that must happen after validation.

Source:
- [Fastify TypeScript](https://fastify.dev/docs/latest/Reference/TypeScript/)
- [Fastify Validation and Serialization](https://fastify.dev/docs/v5.7.x/Reference/Validation-and-Serialization)

### Zod

- Use Zod to define runtime schemas for request bodies, shared DTOs, and config objects.
- Zod is TypeScript-first and gives both runtime validation and static inference.
- Use `parse` when you want exceptions on invalid input.
- Use `safeParse` when you want error handling without throwing.
- Prefer strict object schemas for API payloads when extra keys should be rejected.

Source:
- [Zod introduction](https://zod.dev/)
- [Zod package docs](https://zod.dev/packages/zod)
- [Zod schema definitions](https://zod.dev/api?id=sets)

### Prisma

- Use `schema.prisma` as the source of truth for the database model.
- Use Prisma migrations to evolve the schema.
- Use Prisma Client for typed data access.
- Keep the schema file and generated client aligned with the backend data model.

Source:
- [Prisma schema overview](https://www.prisma.io/docs/orm/prisma-schema/overview)
- [Prisma supported databases](https://docs.prisma.io/docs/orm/core-concepts/supported-databases)

### SQLite

- Use SQLite for local, file-backed metadata storage.
- Keep it for app metadata, dataset records, chart records, versions, and permissions.
- Do not treat SQLite as the analytical engine for large query execution if DuckDB is available.
- In Prisma, the SQLite connection URL uses the `file:` form.

Source:
- [Prisma SQLite connector](https://docs.prisma.io/docs/orm/core-concepts/supported-databases/sqlite)

### DuckDB

- DuckDB is the intended analytical query engine for CSV-style data execution.
- DuckDB is an in-process database, which makes it suitable for local analytical workloads.
- The current DuckDB docs mark the old Node.js package as deprecated and point to the current Node.js client family instead.
- If we add DuckDB, prefer the current official Node.js client docs over the deprecated package docs.

Source:
- [DuckDB client overview](https://duckdb.org/docs/current/clients/overview.html)
- [DuckDB Node.js API](https://duckdb.org/docs/lts/clients/nodejs/overview.html)

### Recharts

- Use Recharts for charts rendered from query result rows.
- Good chart targets here are bar, line, pie, and table-like summaries.
- `ResponsiveContainer` is the wrapper that makes charts adapt to parent size.
- Keep chart input simple: arrays of plain objects.

Source:
- [Recharts getting started](https://recharts.github.io/en-US/guide/getting-started/)
- [Recharts API](https://recharts.github.io/en-US/api/)
- [ResponsiveContainer docs](https://recharts.github.io/en-US/api/ResponsiveContainer)

### shadcn/ui

- Use shadcn/ui as open code, not as a black-box component library.
- Compose components using the documented structure.
- Prefer the generated primitives already present in `apps/web/src/components/ui`.
- Use the project's `components.json` and aliases when adding new shadcn components.

Source:
- [shadcn/ui introduction](https://ui.shadcn.com/docs)
- [shadcn/ui components](https://ui.shadcn.com/docs/components)
- [shadcn/ui components.json](https://ui.shadcn.com/docs/components-json)
- [shadcn/ui skills](https://ui.shadcn.com/docs/skills)

## Implementation Boundaries

- Do not accept arbitrary SQL from the UI.
- Validate structured query configs before execution.
- Cache query results by a stable key that includes dataset version.
- Reject stale chart updates with version checks.
- Show clear empty, error, and stale-data states.
- Keep the README or project docs updated when a major implementation choice is made.

## Current Repo Reality

- The frontend is still the starter Vite app.
- The backend is only a scaffold at the moment.
- The Prisma schema is empty except for generator and datasource setup.
- The existing UI components are generated primitives, not product screens.

## Starting Point For Implementation

1. Define shared schemas and data models.
2. Add the metadata database schema.
3. Add API routes for dataset upload and query preview.
4. Replace the starter frontend with the dashboard shell.
5. Wire query builder state to the preview flow.
