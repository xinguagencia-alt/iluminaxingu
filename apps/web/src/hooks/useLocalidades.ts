import { useEffect, useState } from 'react'
import { API_URL } from '../config/api'
import { normalizarCatalogoLocalidades, type Localidade } from '../localidades'

interface UseLocalidadesResult {
  localidades: Localidade[]
  loading: boolean
  indisponivel: boolean
}

export function useLocalidades(): UseLocalidadesResult {
  const [localidades, setLocalidades] = useState<Localidade[]>([])
  const [loading, setLoading] = useState(true)
  const [indisponivel, setIndisponivel] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    let desmontado = false
    const timeout = window.setTimeout(() => controller.abort(), 12000)

    async function carregar() {
      try {
        const response = await fetch(`${API_URL}/api/localidades`, { signal: controller.signal })
        if (!response.ok) throw new Error('Catálogo indisponível')
        const data: unknown = await response.json()
        if (!desmontado) {
          setLocalidades(normalizarCatalogoLocalidades(data))
          setIndisponivel(false)
        }
      } catch {
        if (!desmontado) {
          setLocalidades([])
          setIndisponivel(true)
        }
      } finally {
        window.clearTimeout(timeout)
        if (!desmontado) setLoading(false)
      }
    }

    void carregar()
    return () => {
      desmontado = true
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [])

  return { localidades, loading, indisponivel }
}
