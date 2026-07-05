const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('DATABASE_URL environment variable is required')
  process.exit(1)
}

const pool = new Pool({ connectionString })

async function main() {
  const seedSql = fs.readFileSync(path.join(__dirname, 'seed-admin.sql'), 'utf8')
  try {
    await pool.query(seedSql)
    console.log('Admin seed executado com sucesso!')
  } catch (err) {
    console.error('Erro:', err.message)
  } finally {
    await pool.end()
  }
}

main()
