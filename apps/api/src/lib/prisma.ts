import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3"
import { PrismaClient } from "../../generated/prisma/index.js"

const moduleDir = dirname(fileURLToPath(import.meta.url))
const apiRoot = join(moduleDir, "..", "..")
const dbPath = join(apiRoot, "dev.db")

const adapter = new PrismaBetterSqlite3({ url: dbPath })

declare global {
  // eslint-disable-next-line no-var
  var __datacanvasPrisma: PrismaClient | undefined
}

export const prisma =
  globalThis.__datacanvasPrisma ??
  new PrismaClient({
    adapter,
  })

if (process.env.NODE_ENV !== "production") {
  globalThis.__datacanvasPrisma = prisma
}
