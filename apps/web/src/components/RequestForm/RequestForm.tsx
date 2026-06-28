import { useState, useEffect, FormEvent } from 'react'
import type { FormData, FormErrors } from './types'
import { TIPOS_PROBLEMA } from './types'
import { MapPicker, MapMarker } from '../MapPicker/MapPicker'
import { usePostes } from '../../hooks/usePostes'
import { FileUpload } from '../FileUpload/FileUpload'
import { SolicitacaoPublica } from '../SolicitacaoPublica/SolicitacaoPublica'
import { API_URL } from '../../config/api'
import styles from './RequestForm.module.css'

const INITIAL_STATE: FormData = {
  nome: '',
  telefone: '',
  email: '',
  latitude: null,
  longitude: null,
  enderecoManual: '',
  codigoPoste: '',
  posteId: null,
  tipoProblema: '',
  descricao: '',
  consentimentoLgpd: false,
}

export function RequestForm() {
  const [formData, setFormData] = useState<FormData>(INITIAL_STATE)
  const [errors, setErrors] = useState<FormErrors>({})
  const [protocolo, setProtocolo] = useState<string | null>(null)
  const [loadingGeo, setLoadingGeo] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [filesToUpload, setFilesToUpload] = useState<File[]>([])
  const [uploadingFiles, setUploadingFiles] = useState(false)
  const [buscaProtocolo, setBuscaProtocolo] = useState('')
  const [protocoloBusca, setProtocoloBusca] = useState<string | null>(null)
  const { postes } = usePostes()

  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoError('Seu navegador nao suporta geolocalizacao')
      return
    }

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)

    if (!isIOS && !isSafari) {
      setLoadingGeo(true)
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFormData((prev) => ({
            ...prev,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          }))
          setLoadingGeo(false)
        },
        (error) => {
          setLoadingGeo(false)
          switch (error.code) {
            case error.PERMISSION_DENIED:
              setGeoError('Permissao de localizacao negada. Toque no botao abaixo para tentar novamente.')
              break
            case error.POSITION_UNAVAILABLE:
              setGeoError('Localizacao indisponivel. Verifique se o GPS esta ativo.')
              break
            case error.TIMEOUT:
              setGeoError('Tempo esgotado. Toque no botao abaixo para tentar novamente.')
              break
            default:
              setGeoError('Nao foi possivel obter a localizacao. Toque no botao abaixo.')
          }
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      )
    }
  }, [])

  function validate(): FormErrors {
    const newErrors: FormErrors = {}

    if (!formData.nome.trim()) {
      newErrors.nome = 'Nome e obrigatorio'
    }

    if (!formData.telefone.trim()) {
      newErrors.contato = 'Informe um telefone para receber o protocolo e o retorno'
    }

    if (formData.email.trim() && !isValidEmail(formData.email)) {
      newErrors.contato = 'E-mail invalido'
    }

    if (!formData.tipoProblema) {
      newErrors.tipoProblema = 'Selecione o tipo de problema'
    }

    if (!formData.consentimentoLgpd) {
      newErrors.consentimentoLgpd = 'Voce deve concordar com o uso dos dados para enviar a solicitacao'
    }

    return newErrors
  }

  function isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  async function uploadFilePublico(file: File, solicitacaoId: number): Promise<boolean> {
    try {
      const formData = new FormData()
      formData.append('arquivo', file)
      formData.append('solicitacao_id', String(solicitacaoId))

      const response = await fetch(`${API_URL}/api/anexos/upload-public`, {
        method: 'POST',
        body: formData,
      })

      return response.ok
    } catch {
      return false
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const validationErrors = validate()

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    setErrors({})
    setSubmitting(true)
    setSubmitError(null)

    try {
      const response = await fetch(`${API_URL}/api/solicitacoes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nome_solicitante: formData.nome.trim(),
          telefone: formData.telefone.trim(),
          email: formData.email.trim() || null,
          codigo_poste: formData.codigoPoste.trim() || null,
          poste_id: formData.posteId,
          endereco_informado: formData.enderecoManual.trim() || null,
          latitude: formData.latitude,
          longitude: formData.longitude,
          tipo_problema: formData.tipoProblema,
          descricao: formData.descricao.trim() || null,
          consentimento_lgpd: formData.consentimentoLgpd,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Erro ao enviar solicitacao')
      }

      const data = await response.json()
      setProtocolo(data.protocolo)

      if (filesToUpload.length > 0) {
        setUploadingFiles(true)
        for (const file of filesToUpload) {
          await uploadFilePublico(file, data.id)
        }
        setUploadingFiles(false)
        setFilesToUpload([])
      }
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Erro ao conectar com o servidor'
      )
    } finally {
      setSubmitting(false)
    }
  }

  function handleChange(field: keyof FormData, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  function handleLocationSelect(lat: number, lng: number) {
    setFormData((prev) => ({ ...prev, latitude: lat, longitude: lng }))
  }

  function captureLocation() {
    if (!navigator.geolocation) {
      setGeoError('Seu navegador nao suporta geolocalizacao')
      return
    }

    setLoadingGeo(true)
    setGeoError(null)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData((prev) => ({
          ...prev,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }))
        setLoadingGeo(false)
      },
      (error) => {
        setLoadingGeo(false)
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setGeoError('Permissao de localizacao negada. Ative nas configuracoes do navegador.')
            break
          case error.POSITION_UNAVAILABLE:
            setGeoError('Localizacao indisponivel. Verifique se o GPS esta ativo.')
            break
          case error.TIMEOUT:
            setGeoError('Tempo esgotado. Tente novamente.')
            break
          default:
            setGeoError('Erro ao obter localizacao.')
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  }

  function handlePostSelect(marker: MapMarker) {
    setFormData((prev) => ({
      ...prev,
      codigoPoste: marker.label,
      posteId: typeof marker.id === 'number' ? marker.id : null,
    }))
  }

  if (protocoloBusca) {
    return (
      <SolicitacaoPublica
        initialProtocolo={protocoloBusca}
        onVoltar={() => setProtocoloBusca(null)}
      />
    )
  }

  if (protocolo) {
    return (
      <div className={styles.success}>
        <h2>Solicitacao Enviada!</h2>
        <p>Seu numero de protocolo e:</p>
        <span className={styles.protocol}>{protocolo}</span>
        <p className={styles.info}>
          Guarde este numero para acompanhar sua solicitacao.
        </p>
        <button
          className={styles.button}
          onClick={() => {
            setProtocolo(null)
            setFormData(INITIAL_STATE)
          }}
        >
          Nova Solicitacao
        </button>
      </div>
    )
  }

  return (
    <div className={styles.pageContainer}>
      <div className={styles.searchBar}>
        <span className={styles.searchBarLabel}>Ja possui um protocolo?</span>
        <form
          className={styles.searchBarForm}
          onSubmit={(e) => {
            e.preventDefault()
            if (buscaProtocolo.trim()) setProtocoloBusca(buscaProtocolo.trim())
          }}
        >
          <input
            type="text"
            className={styles.searchBarInput}
            value={buscaProtocolo}
            onChange={(e) => setBuscaProtocolo(e.target.value)}
            placeholder="Ex: ILX20260625-ABC123"
          />
          <button type="submit" className={styles.searchBarButton} disabled={!buscaProtocolo.trim()}>
            Consultar
          </button>
        </form>
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
      <section className={styles.section}>
        <h2>Dados Pessoais</h2>

        <div className={styles.field}>
          <label htmlFor="nome">Nome *</label>
          <input
            id="nome"
            type="text"
            value={formData.nome}
            onChange={(e) => handleChange('nome', e.target.value)}
            placeholder="Seu nome completo"
          />
          {errors.nome && <span className={styles.error}>{errors.nome}</span>}
        </div>

        <div className={styles.field}>
          <label htmlFor="telefone">Telefone *</label>
          <input
            id="telefone"
            type="tel"
            value={formData.telefone}
            onChange={(e) => handleChange('telefone', e.target.value)}
            placeholder="(XX) XXXXX-XXXX"
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="email">E-mail (opcional)</label>
          <input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
            placeholder="seu@email.com"
          />
        </div>

        {errors.contato && (
          <span className={styles.error}>{errors.contato}</span>
        )}
      </section>

      <section className={styles.section}>
        <h2>Localizacao</h2>

        {loadingGeo && (
          <p className={styles.geoLoading}>Obtendo localizacao GPS...</p>
        )}

        {!loadingGeo && formData.latitude !== null && formData.longitude !== null && (
          <p className={styles.geoInfo}>
            Localizacao capturada com sucesso!
          </p>
        )}

        {geoError && (
          <p className={styles.geoError}>{geoError}</p>
        )}

        {formData.latitude === null && !loadingGeo && (
          <button
            type="button"
            className={styles.geoButton}
            onClick={captureLocation}
          >
            Detectar minha localizacao
          </button>
        )}

        {formData.latitude !== null && !loadingGeo && (
          <button
            type="button"
            className={styles.geoButtonSecondary}
            onClick={captureLocation}
          >
            Atualizar localizacao
          </button>
        )}

        <MapPicker
          latitude={formData.latitude}
          longitude={formData.longitude}
          onLocationSelect={handleLocationSelect}
          onPostSelect={handlePostSelect}
          markers={postes}
        />

        <div className={styles.field}>
          <label htmlFor="endereco">
            Endereco manual (se nao souber a localizacao exata)
          </label>
          <input
            id="endereco"
            type="text"
            value={formData.enderecoManual}
            onChange={(e) => handleChange('enderecoManual', e.target.value)}
            placeholder="Rua, numero, bairro, referencia"
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="codigoPoste">Codigo do poste (se souber)</label>
          <input
            id="codigoPoste"
            type="text"
            value={formData.codigoPoste}
            onChange={(e) => handleChange('codigoPoste', e.target.value)}
            placeholder="Ex: POSTE-00123"
          />
        </div>
      </section>

      <section className={styles.section}>
        <h2>Problema</h2>

        <div className={styles.field}>
          <label htmlFor="tipoProblema">Tipo de problema *</label>
          <select
            id="tipoProblema"
            value={formData.tipoProblema}
            onChange={(e) => handleChange('tipoProblema', e.target.value)}
          >
            <option value="">Selecione...</option>
            {TIPOS_PROBLEMA.map((tipo) => (
              <option key={tipo.value} value={tipo.value}>
                {tipo.label}
              </option>
            ))}
          </select>
          {errors.tipoProblema && (
            <span className={styles.error}>{errors.tipoProblema}</span>
          )}
        </div>

        <div className={styles.field}>
          <label htmlFor="descricao">Observacoes</label>
          <textarea
            id="descricao"
            value={formData.descricao}
            onChange={(e) => handleChange('descricao', e.target.value)}
            placeholder="Descreva o problema com mais detalhes (opcional)"
            rows={4}
          />
        </div>
      </section>

      <section className={styles.section}>
        <h2>Anexos (opcional)</h2>
        <p className={styles.info}>
          Envie fotos ou documentos que ajudem a identificar o problema.
        </p>
        <FileUpload
          onUpload={async (file) => {
            setFilesToUpload((prev) => [...prev, file])
            return true
          }}
          uploading={uploadingFiles}
          disabled={submitting}
        />
        {filesToUpload.length > 0 && (
          <ul className={styles.fileList}>
            {filesToUpload.map((f, i) => (
              <li key={i} className={styles.fileItem}>
                <span>{f.name}</span>
                <button
                  type="button"
                  className={styles.removeFileButton}
                  onClick={() => setFilesToUpload((prev) => prev.filter((_, idx) => idx !== i))}
                  disabled={submitting}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.lgpdConsent}>
          <label className={styles.lgpdLabel}>
            <input
              type="checkbox"
              checked={formData.consentimentoLgpd}
              onChange={(e) => setFormData((prev) => ({ ...prev, consentimentoLgpd: e.target.checked }))}
              className={styles.lgpdCheckbox}
            />
            <span className={styles.lgpdText}>
              Declaro que li e concordo com o uso dos meus dados para fins de atendimento da solicitacao, conforme a LGPD.
            </span>
          </label>
          {errors.consentimentoLgpd && (
            <span className={styles.error}>{errors.consentimentoLgpd}</span>
          )}
        </div>
      </section>

      {submitError && <p className={styles.error}>{submitError}</p>}

      <button type="submit" className={styles.button} disabled={submitting}>
        {submitting ? 'Enviando...' : 'Enviar Solicitacao'}
      </button>
    </form>
    </div>
  )
}
