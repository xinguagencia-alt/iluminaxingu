import { useEffect, useRef, useState, useCallback } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useAuth } from '../../contexts/AuthContext'
import { API_URL } from '../../config/api'
import styles from './MapaPostes.module.css'

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl

const XINGU_CENTER: [number, number] = [-6.6153, -51.9640]
const DEFAULT_ZOOM = 13

const COR_PADRAO = '#9ca3af'

interface PosteMapa {
  id: number
  codigo: string
  endereco: string | null
  rua: string | null
  numero: string | null
  bairro: string | null
  bairro_normalizado: string
  complemento: string | null
  latitude: number | null
  longitude: number | null
  tipo_luminaria: string | null
  potencia: number | null
  status_ativo: boolean
}

interface BairroCor {
  id: number
  nome: string
  cor: string | null
}

interface MapaData {
  postes: PosteMapa[]
  bairros: BairroCor[]
  totaisPorBairro: Record<string, number>
  total: number
}

function createColoredIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: '',
    iconSize: [16, 22],
    iconAnchor: [8, 22],
    popupAnchor: [0, -22],
    html: `<svg width="16" height="22" viewBox="0 0 16 22" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 5.25 8 14 8 14s8-8.75 8-14c0-4.42-3.58-8-8-8z" fill="${color}"/>
      <circle cx="8" cy="8" r="3" fill="white"/>
    </svg>`,
  })
}

export function MapaPostes() {
  const { token } = useAuth()
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const markersRef = useRef<L.Marker[]>([])
  const [data, setData] = useState<MapaData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const corMap = useRef<Map<string, string>>(new Map())

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`${API_URL}/api/postes/mapa`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) throw new Error('Erro ao carregar dados do mapa')
      const result = await response.json()
      setData({
        postes: Array.isArray(result.postes) ? result.postes : [],
        bairros: Array.isArray(result.bairros) ? result.bairros : [],
        totaisPorBairro: result.totaisPorBairro || {},
        total: typeof result.total === 'number' ? result.total : 0,
      })

      corMap.current.clear()
      const bairros = Array.isArray(result.bairros) ? result.bairros : []
      for (const b of bairros) {
        if (b.cor) corMap.current.set(b.nome, b.cor)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao conectar com o servidor')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return

    const map = L.map(mapRef.current).setView(XINGU_CENTER, DEFAULT_ZOOM)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map)

    mapInstanceRef.current = map

    return () => {
      map.remove()
      mapInstanceRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !data) return

    markersRef.current.forEach((m) => map.removeLayer(m))
    markersRef.current = []

    for (const poste of data.postes) {
      if (poste.latitude == null || poste.longitude == null) continue

      const bairroNome = poste.bairro_normalizado
      const color = corMap.current.get(bairroNome) || COR_PADRAO
      const icon = createColoredIcon(color)

      const popupHtml = `
        <div class="${styles.popup}">
          <div class="${styles.popupCodigo}">${poste.codigo}</div>
          <div class="${styles.popupInfo}">
            ${poste.rua ? `${poste.rua}${poste.numero ? `, ${poste.numero}` : ''}` : 'Sem endereco'}<br/>
            ${poste.tipo_luminaria ? `${poste.tipo_luminaria}${poste.potencia ? ` - ${poste.potencia}W` : ''}` : ''}
          </div>
          <div class="${styles.popupBairro}">
            <span class="${styles.popupBairroDot}" style="background:${color}"></span>
            ${bairroNome}
          </div>
        </div>
      `

      const marker = L.marker([Number(poste.latitude), Number(poste.longitude)], { icon })
        .bindPopup(popupHtml)
        .addTo(map)

      markersRef.current.push(marker)
    }
  }, [data])

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.sidebar}>
          <div className={styles.loading}>
            <div className={styles.spinner} />
            <p>Carregando mapa...</p>
          </div>
        </div>
        <div className={styles.mapArea}>
          <div ref={mapRef} className={styles.map} />
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className={styles.container}>
        <div className={styles.sidebar}>
          <div className={styles.loading}>
            <p style={{ color: '#dc2626' }}>{error || 'Erro ao carregar dados'}</p>
            <button
              onClick={fetchData}
              style={{
                marginTop: 12, padding: '8px 16px', background: '#f59e0b',
                color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer',
              }}
            >
              Tentar novamente
            </button>
          </div>
        </div>
        <div className={styles.mapArea}>
          <div ref={mapRef} className={styles.map} />
        </div>
      </div>
    )
  }

  const bairrosComPostes = Object.entries(data.totaisPorBairro)
    .map(([nome, count]) => ({
      nome,
      count,
      cor: corMap.current.get(nome) || null,
    }))
    .sort((a, b) => b.count - a.count)

  const semLocalizacao = data.postes.filter(
    (p) => p.latitude == null || p.longitude == null
  ).length

  return (
    <div className={styles.container}>
      <div className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h2>Mapa de Postes</h2>
          <p>Sao Felix do Xingu - PA</p>
        </div>

        <div className={styles.stats}>
          <div className={styles.statsTotal}>{data.total}</div>
          <div className={styles.statsLabel}>
            poste{data.total !== 1 ? 's' : ''} cadastrado{data.total !== 1 ? 's' : ''}
            {semLocalizacao > 0 && ` · ${semLocalizacao} sem localizacao`}
          </div>
        </div>

        <div className={styles.legend}>
          <div className={styles.legendTitle}>Postes por bairro</div>

          {bairrosComPostes.map((b) => (
            <div key={b.nome} className={styles.legendItem}>
              <span
                className={styles.legendColor}
                style={{ background: b.cor || COR_PADRAO }}
              />
              <span className={styles.legendNome}>{b.nome}</span>
              <span className={styles.legendCount}>{b.count}</span>
            </div>
          ))}

          {bairrosComPostes.length === 0 && (
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', fontStyle: 'italic' }}>
              Nenhum poste com bairro definido
            </p>
          )}

          <div className={styles.legendSemCor}>
            <span className={styles.legendSemCorIcon} />
            <span className={styles.legendSemCorText}>
              Cor padrao para bairros sem cor
            </span>
          </div>
        </div>
      </div>

      <div className={styles.mapArea}>
        <div ref={mapRef} className={styles.map} />
      </div>
    </div>
  )
}
