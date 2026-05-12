import { buildServer } from "./server"

const server = await buildServer()
const port = Number(process.env.PORT ?? 8787)
const host = process.env.HOST ?? "0.0.0.0"

async function main() {
  try {
    await server.listen({ port, host })
    console.log(`API listening on http://${host}:${port}`)
  } catch (error) {
    server.log.error(error)
    process.exit(1)
  }
}

void main()
