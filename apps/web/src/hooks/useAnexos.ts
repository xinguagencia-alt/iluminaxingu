import { useCallback, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { API_URL } from '../config/api'

export interface Anexo {
  id: number
  solicitacao_id: number | null
  ordem_servico_id: number | null
  arquivo_nome: string
  arquivo_path: string
  arquivo_tipo: string | null
  tamanho_bytes: number | null
  criado_em: string
}

interface UseAnexosResult {
  uploading: boolean
  upload: (file: File, solicitacaoId?: number, ordemServicoId?: number) => Promise<Anexo | null>
  remover: (id: number) => Promise<boolean>
  download: (id: number, filename: string) => Promise<boolean>
}

export function useAnexos(): UseAnexosResult {
  const { token } = useAuth()
  const [uploading, setUploading] = useState(false)

  const upload = useCallback(
    async (file: File, solicitacaoId?: number, ordemServicoId?: number): Promise<Anexo | null> => {
      setUploading(true)
      if (!token) {
        setUploading(false)
        return null
      }
      try {
        const formData = new FormData()
        formData.append('arquivo', file)
        if (solicitacaoId) formData.append('solicitacao_id', String(solicitacaoId))
        if (ordemServicoId) formData.append('ordem_servico_id', String(ordemServicoId))

        const response = await fetch(`${API_URL}/api/anexos/upload`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Erro ao enviar arquivo')
        }

        return await response.json()
      } catch {
        return null
      } finally {
        setUploading(false)
      }
    },
    [token]
  )

  const remover = useCallback(
    async (id: number): Promise<boolean> => {
      if (!token) return false
      try {
        const response = await fetch(`${API_URL}/api/anexos/${id}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
        return response.ok
      } catch {
        return false
      }
    },
    [token]
  )

  const download = useCallback(
    async (id: number, filename: string): Promise<boolean> => {
      if (!token) return false
      try {
        const response = await fetch(`${API_URL}/api/anexos/${id}/download`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (!response.ok) return false

        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = filename
        document.body.appendChild(anchor)
        anchor.click()
        anchor.remove()
        window.URL.revokeObjectURL(url)
        return true
      } catch {
        return false
      }
    },
    [token]
  )

  return { uploading, upload, remover, download }
}






