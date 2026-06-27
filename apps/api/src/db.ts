import pg from 'pg'

const dbUser = process.env.DB_USER
const dbPassword = process.env.DB_PASSWORD

if (!dbUser || !dbPassword) {
  console.error('[FATAL] Variaveis de ambiente obrigatorias nao definidas:')
  if (!dbUser) console.error('  - DB_USER: ausente')
  if (!dbPassword) console.error('  - DB_PASSWORD: ausente')
  console.error('Configure-as no arquivo .env e reinicie o servidor.')
  process.exit(1)
}

const pool = new pg.Pool({
  user: dbUser,
  password: dbPassword,
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'iluminaxingu',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

export const db = {
  query: (text: string, params?: unknown[]) => pool.query(text, params),
  getClient: () => pool.connect(),
}

export default pool
