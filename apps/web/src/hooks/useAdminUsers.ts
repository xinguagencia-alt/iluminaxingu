import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { API_URL } from '../config/api'

export interface AdminUser {
  id: number
  username: string
  nomeCompleto: string
  perfil: string
  ativo: boolean
  criadoEm: string
}

export interface UserPayload {
  username: string
  nomeCompleto: string
  perfil: string
  ativo?: boolean
  password?: string
}

interface UseAdminUsersResult {
  users: AdminUser[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  createUser: (payload: UserPayload) => Promise<boolean>
  updateUser: (id: number, payload: Partial<UserPayload>) => Promise<boolean>
}

export function useAdminUsers(): UseAdminUsersResult {
  const { token } = useAuth()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_URL}/api/auth/users`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) {
        throw new Error('Erro ao carregar usuarios')
      }

      setUsers(await response.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao conectar com o servidor')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    refetch()
  }, [refetch])

  const createUser = useCallback(
    async (payload: UserPayload): Promise<boolean> => {
      try {
        const response = await fetch(`${API_URL}/api/auth/users`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        })

        if (!response.ok) return false
        await refetch()
        return true
      } catch {
        return false
      }
    },
    [token, refetch]
  )

  const updateUser = useCallback(
    async (id: number, payload: Partial<UserPayload>): Promise<boolean> => {
      try {
        const response = await fetch(`${API_URL}/api/auth/users/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        })

        if (!response.ok) return false
        await refetch()
        return true
      } catch {
        return false
      }
    },
    [token, refetch]
  )

  return { users, loading, error, refetch, createUser, updateUser }
}
