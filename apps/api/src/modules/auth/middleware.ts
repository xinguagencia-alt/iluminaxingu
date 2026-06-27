import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { getJwtSecret } from '../../config/env.js'

export interface AuthPayload {
  userId: number
  username: string
  nomeCompleto: string
  perfil: string
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token nao fornecido' })
    return
  }

  const token = authHeader.split(' ')[1]

  try {
    const payload = jwt.verify(token, getJwtSecret()) as AuthPayload
    req.user = payload
    next()
  } catch {
    res.status(401).json({ error: 'Token invalido' })
  }
}

export function requireRole(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.perfil)) {
      res.status(403).json({ error: 'Acesso nao autorizado' })
      return
    }

    next()
  }
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '8h' })
}
