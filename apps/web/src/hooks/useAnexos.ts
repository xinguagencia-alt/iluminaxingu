import { useCallback, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3333'

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
}

export function useAnexos(): UseAnexosResult {
  const { token } = useAuth()
  const [uploading, setUploading] = useState(false)

  const upload = useCallback(
    async (file: File, solicitacaoId?: number, ordemServicoId?: number): Promise<Anexo | null> => {
      setUploading(true)
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

  return { uploading, upload, remover }
}

export function getDownloadUrl(anexoId: number): string {
  return `${API_URL}/api/anexos/${anexoId}/download`
}
