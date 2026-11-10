import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import { executar } from './setup.js'

const { createApp } = await import('../../src/app.js')
const { signToken } = await import('../../src/modules/auth/middleware.js')

const app = createApp()

const server: Server = await new Promise((resolve) => {
  const s = app.listen(0, '127.0.0.1', () => resolve(s))
})

const endereco = server.address() as AddressInfo
export const baseUrl = `http://127.0.0.1:${endereco.port}`

export const token = signToken({
  userId: 1,
  username: 'admin',
  nomeCompleto: 'Administrador de Teste',
  perfil: 'admin',
})

export const cabecalhoAuth = { Authorization: `Bearer ${token}` }

await executar(
  `INSERT INTO admin_users (id, username, password_hash, nome_completo, perfil)
   VALUES (1, 'admin', 'hash-de-teste', 'Administrador', 'admin')`
)
await executar(`INSERT INTO equipes (id, nome, responsavel, ativo) VALUES (1, 'Equipe Alpha', 'Joao', TRUE)`)

export async function encerrarServico(): Promise<void> {
  await new Promise((resolve) => server.close(resolve))
}
