import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { GIFT_CATALOG } from '../mock/catalog.js'
import { CATALOG_SCHEMA_VERSION, validateCatalog } from '../src/data/catalogSchema.js'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const outputPath = resolve(scriptDir, '..', 'data', 'giftmind-seed-catalog.json')
const errors = validateCatalog(GIFT_CATALOG)

if (errors.length) {
  console.error(`Refusing to export an invalid catalog (${errors.length} errors):`)
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

const records = [...GIFT_CATALOG]
  .map((record) => ({ ...record }))
  .sort((left, right) => String(left.id).localeCompare(String(right.id), 'en'))

const payload = {
  schemaVersion: CATALOG_SCHEMA_VERSION,
  exportedAt: null,
  source: 'giftmind-h5/mock/catalog.js',
  importPolicy: {
    defaultStatus: 'draft',
    identity: ['kind', 'name'],
    overwriteExisting: false,
  },
  count: records.length,
  records,
}

await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')

console.log(`Exported ${records.length} gifts to ${outputPath}`)
