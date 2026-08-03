import { useState, useEffect, FormEvent } from 'react'
import type { FormData, FormErrors } from './types'
import { TIPOS_PROBLEMA } from './types'
import { MapPicker, MapMarker } from '../MapPicker/MapPicker'
import { usePostes } from '../../hooks/usePostes'
import { FileUpload } from '../FileUpload/FileUpload'
import { SolicitacaoPublica } from '../SolicitacaoPublica/SolicitacaoPublica'
import { API_URL } from '../../config/api'
import styles from './RequestForm.module.css'

function normalizarTelefone(telefone: string): string | null {
  const apenasNumeros = telefone.replace(/\D/g, '')
  if (apenasNumeros.length === 10 || apenasNumeros.length === 11) {
    return `55${apenasNumeros}`
  }
  if (
    (apenasNumeros.length === 12 || apenasNumeros.length === 13) &&
    apenasNumeros.startsWith('55')
  ) {
    return apenasNumeros
  }
  return null
}

function montarMensagemProtocolo(nome: string, protocolo: string): string {
  const nomeFormatado = nome.split(' ')[0]
  return (
    `Ola, ${nomeFormatado}. Sua solicitacao de iluminacao publica foi registrada no IluminaXingu. ` +
    `Protocolo: ${protocolo}. Guarde este numero para acompanhar o andamento.`
  )
}

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
  const [posteIdentificado, setPosteIdentificado] = useState<string | null>(null)
  const [copyFeedback, setCopyFeedback] = useState(false)
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

  async function uploadFilePublico(file: File, solicitacaoId: number, protocolo: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const formData = new FormData()
      formData.append('arquivo', file)
      formData.append('solicitacao_id', String(solicitacaoId))
      formData.append('protocolo', protocolo)

      const response = await fetch(`${API_URL}/api/anexos/upload-public`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        return { ok: false, error: data.error || 'Erro ao enviar arquivo' }
      }
      return { ok: true }
    } catch {
      return { ok: false, error: 'Erro de conexao ao enviar arquivo' }
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

      if (data.auto_identificado && data.codigo_poste_informado) {
        setPosteIdentificado(data.codigo_poste_informado)
      }

      if (filesToUpload.length > 0) {
        setUploadingFiles(true)
        const uploadErrors: string[] = []
        for (const file of filesToUpload) {
          const result = await uploadFilePublico(file, data.id, data.protocolo)
          if (!result.ok && result.error) {
            uploadErrors.push(`${file.name}: ${result.error}`)
          }
        }
        setUploadingFiles(false)
        setFilesToUpload([])
        if (uploadErrors.length > 0) {
          setSubmitError(`Solicitacao enviada, mas houve erro no upload:\n${uploadErrors.join('\n')}`)
        }
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
    const telefoneNormalizado = normalizarTelefone(formData.telefone)
    const mensagem = montarMensagemProtocolo(formData.nome, protocolo)
    const whatsappUrl = telefoneNormalizado
      ? `https://wa.me/${telefoneNormalizado}?text=${encodeURIComponent(mensagem)}`
      : null

    async function handleCopiarMensagem() {
      try {
        await navigator.clipboard.writeText(mensagem)
        setCopyFeedback(true)
        setTimeout(() => setCopyFeedback(false), 2500)
      } catch {
        const textarea = document.createElement('textarea')
        textarea.value = mensagem
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
        setCopyFeedback(true)
        setTimeout(() => setCopyFeedback(false), 2500)
      }
    }

    return (
      <div className={styles.success}>
        <h2>Solicitacao Enviada!</h2>
        <p>Seu numero de protocolo e:</p>
        <span className={styles.protocol}>{protocolo}</span>
        {posteIdentificado && (
          <p className={styles.autoIdentificado}>
            Poste identificado automaticamente: <strong>{posteIdentificado}</strong>
          </p>
        )}
        <p className={styles.info}>
Guarde esse numero. Com ele, voce pode consultar o andamento sempre que precisar.
        </p>

        <div className={styles.whatsappSection}>
          {whatsappUrl ? (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.whatsappButton}
            >
              Enviar pelo WhatsApp
            </a>
          ) : (
            <button
              type="button"
              className={styles.whatsappButton}
              onClick={handleCopiarMensagem}
            >
              Copiar mensagem
            </button>
          )}
          {whatsappUrl && (
            <button
              type="button"
              className={styles.copyButton}
              onClick={handleCopiarMensagem}
            >
              {copyFeedback ? 'Copiado!' : 'Copiar mensagem'}
            </button>
          )}
        </div>

        <button
          className={styles.button}
          onClick={() => {
            setProtocolo(null)
            setPosteIdentificado(null)
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
      <section className={styles.heroPanel}>
        <div className={styles.heroCopy}>
          <span className={styles.heroEyebrow}>Atendimento digital</span>
          <h2 className={styles.heroTitle}>Abra sua solicitacao em poucos minutos</h2>
          <p className={styles.heroText}>
            Informe o problema, compartilhe a localizacao e envie fotos para ajudar a equipe da prefeitura a chegar mais rapido ao ponto correto.
          </p>
        </div>
        <div className={styles.heroStats}>
          <div className={styles.heroStat}>
            <strong>GPS</strong>
            <span>Captura de localizacao pelo celular</span>
          </div>
          <div className={styles.heroStat}>
            <strong>Fotos</strong>
            <span>Anexos para identificar o problema</span>
          </div>
          <div className={styles.heroStat}>
            <strong>Protocolo</strong>
            <span>Consulta simples do andamento</span>
          </div>
        </div>
      </section>

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
        <div className={styles.sectionHeader}>
          <span className={styles.sectionStep}>01</span>
          <div>
            <h2>Dados Pessoais</h2>
            <p>Informe seus dados para receber o protocolo e o retorno da equipe.</p>
          </div>
        </div>
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
            inputMode="tel"
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

        <p className={styles.helperText}>Use um telefone que esteja com WhatsApp ou receba ligacoes para facilitar o retorno.</p>

        {errors.contato && (
          <span className={styles.error}>{errors.contato}</span>
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionStep}>02</span>
          <div>
            <h2>Localizacao</h2>
            <p>Se estiver em frente ao poste, toque no botao de GPS. Depois, ajuste no mapa apenas se precisar.</p>
          </div>
        </div>

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
Usar minha localizacao
          </button>
        )}

        {formData.latitude !== null && !loadingGeo && (
          <button
            type="button"
            className={styles.geoButtonSecondary}
            onClick={captureLocation}
          >
Atualizar GPS
          </button>
        )}

        <p className={styles.helperText}>Se o mapa abrir em outro ponto, toque exatamente onde esta o poste para corrigir.</p>

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
        <div className={styles.sectionHeader}>
          <span className={styles.sectionStep}>03</span>
          <div>
            <h2>Problema</h2>
            <p>Selecione o defeito principal e conte algo importante que ajude a equipe no atendimento.</p>
          </div>
        </div>

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
          {(formData.tipoProblema === 'risco_eletrico' || formData.tipoProblema === 'fio_exposto') && (
            <span className={styles.prioridadeInfo}>
              Casos com risco eletrico recebem prioridade urgente de atendimento.
            </span>
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
        <div className={styles.sectionHeader}>
          <span className={styles.sectionStep}>04</span>
          <div>
            <h2>Anexos (opcional)</h2>
            <p>Fotos ajudam a equipe a entender a situacao antes de sair para o atendimento.</p>
          </div>
        </div>
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
        <div className={styles.sectionHeader}>
          <span className={styles.sectionStep}>05</span>
          <div>
            <h2>Confirmacao dos dados</h2>
            <p>Confira os dados e autorize o uso das informacoes somente para tratar este pedido.</p>
          </div>
        </div>
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
