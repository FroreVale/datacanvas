import type {
  DatasetColumn,
  DatasetColumnType,
  QueryValue,
} from "../../../../packages/shared/src/index.ts"

export type ParsedCsvRow = Record<string, QueryValue>

export type ParsedCsvDataset = {
  name: string
  description: string
  sourceFilename: string
  columns: DatasetColumn[]
  rows: ParsedCsvRow[]
}

function titleize(value: string) {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim()
}

function sanitizeHeader(value: string, index: number) {
  const trimmed = value.trim()
  if (trimmed.length > 0) {
    return trimmed
  }

  return `column_${index + 1}`
}

export function parseCsv(csvText: string): string[][] {
  const text = csvText.replace(/^\uFEFF/, "")
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let index = 0
  let inQuotes = false

  const pushCell = () => {
    row.push(cell)
    cell = ""
  }

  const pushRow = () => {
    if (row.length > 0 || cell.length > 0) {
      pushCell()
      rows.push(row)
    }
    row = []
  }

  while (index < text.length) {
    const char = text[index]
    const next = text[index + 1]

    if (inQuotes) {
      if (char === '"' && next === '"') {
        cell += '"'
        index += 2
        continue
      }

      if (char === '"') {
        inQuotes = false
        index += 1
        continue
      }

      cell += char
      index += 1
      continue
    }

    if (char === '"') {
      inQuotes = true
      index += 1
      continue
    }

    if (char === ",") {
      pushCell()
      index += 1
      continue
    }

    if (char === "\r") {
      pushRow()
      if (next === "\n") {
        index += 2
      } else {
        index += 1
      }
      continue
    }

    if (char === "\n") {
      pushRow()
      index += 1
      continue
    }

    cell += char
    index += 1
  }

  if (cell.length > 0 || row.length > 0) {
    pushRow()
  }

  return rows.filter((current, currentIndex) =>
    currentIndex === 0 ? current.length > 0 : current.some((value) => value.length > 0),
  )
}

function isBooleanLike(value: string) {
  return /^(true|false|yes|no|0|1)$/i.test(value.trim())
}

function parseBoolean(value: string) {
  return /^(true|yes|1)$/i.test(value.trim())
}

function isNumberLike(value: string) {
  return value.trim().length > 0 && Number.isFinite(Number(value))
}

function isDateLike(value: string) {
  if (value.trim().length === 0) {
    return false
  }

  const time = Date.parse(value)
  return Number.isFinite(time)
}

function inferColumnType(values: string[]): DatasetColumnType {
  const nonEmptyValues = values.filter((value) => value.trim().length > 0)

  if (nonEmptyValues.length === 0) {
    return "string"
  }

  const allBoolean = nonEmptyValues.every(isBooleanLike)
  if (allBoolean) {
    return "boolean"
  }

  const allNumber = nonEmptyValues.every(isNumberLike)
  if (allNumber) {
    return "number"
  }

  const allDate = nonEmptyValues.every(isDateLike)
  if (allDate) {
    return "date"
  }

  return "string"
}

function convertValue(value: string, type: DatasetColumnType): QueryValue {
  const trimmed = value.trim()

  if (trimmed.length === 0) {
    return null
  }

  switch (type) {
    case "number":
      return Number(trimmed)
    case "boolean":
      return parseBoolean(trimmed)
    case "date":
      return trimmed
    default:
      return trimmed
  }
}

export function inferCsvDataset(filename: string, csvText: string): ParsedCsvDataset {
  const rows = parseCsv(csvText)

  if (rows.length === 0) {
    throw new Error("CSV file is empty")
  }

  const [headerRow, ...dataRows] = rows
  if (!headerRow || headerRow.length === 0) {
    throw new Error("CSV is missing headers")
  }

  const headers = headerRow.map(sanitizeHeader)
  const columnValues = headers.map(() => [] as string[])

  for (const dataRow of dataRows) {
    headers.forEach((_, columnIndex) => {
      columnValues[columnIndex]?.push(dataRow[columnIndex] ?? "")
    })
  }

  const columns: DatasetColumn[] = headers.map((header, index) => {
    const values = columnValues[index] ?? []
    const type = inferColumnType(values)
    const nullable = values.some((value) => value.trim().length === 0)

    return {
      name: header,
      label: titleize(header),
      type,
      nullable,
    }
  })

  const typedRows = dataRows
    .filter((row) => row.some((value) => value.trim().length > 0))
    .map((row) => {
      const record: ParsedCsvRow = {}

      headers.forEach((header, index) => {
        const column = columns[index]
        if (!column) {
          return
        }

        record[header] = convertValue(row[index] ?? "", column.type)
      })

      return record
    })

  const datasetName = titleize(filename.replace(/\.[^.]+$/, "")) || "Imported dataset"

  return {
    name: datasetName,
    description: `Imported from ${filename}`,
    sourceFilename: filename,
    columns,
    rows: typedRows,
  }
}
