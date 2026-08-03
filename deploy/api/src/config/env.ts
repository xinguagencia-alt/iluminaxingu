import dotenv from 'dotenv'

dotenv.config()

export function getRequiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export function getJwtSecret(): string {
  return getRequiredEnv('JWT_SECRET')
}
