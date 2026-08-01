import { CATALOG_SUMMARY, validateDemoCatalog } from '../mock/catalog.js'

const errors = validateDemoCatalog()

if (errors.length) {
  console.error(`Catalog check failed: ${errors.length} error(s)`)
  errors.forEach((error) => console.error(`- ${error}`))
  process.exit(1)
}

console.log('GiftMind catalog is valid')
console.log(JSON.stringify(CATALOG_SUMMARY, null, 2))
