const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')

const pool = new Pool({
  connectionString: 'postgresql://postgres:iSgzxoyBwDkfPqBecGynOIsbYhdlPEaP@reseau.proxy.rlwy.net:29088/railway'
})

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
