import type { IncomingMessage, ServerResponse } from 'node:http'
import express from 'express'

let fullApp: express.Express | null = null
let schemaReady = false

async function getFullApp(): Promise<express.Express> {
  if (fullApp) return fullApp

  const { createApp } = await import('./app.js')
  const { ensureDatabaseSchema } = await import('./schema.js')

  fullApp = createApp()

  if (!schemaReady) {
    try {
      await ensureDatabaseSchema()
      schemaReady = true
    } catch (err) {
      console.error('Schema migration error:', err)
    }
  }

  return fullApp
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const app = await getFullApp()
  return app(req, res)
}

