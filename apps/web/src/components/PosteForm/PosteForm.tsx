import { useState, FormEvent } from 'react'
import { PosteFormData, PosteFormErrors, TIPOS_LUMINARIA } from './types'
import { MapPicker } from '../MapPicker/MapPicker'
import { API_URL } from '../../config/api'
import styles from './PosteForm.module.css'

const INITIAL_STATE: PosteFormData = {
  codigo: '',
  endereco: '',
  latitude: '',
  longitude: '',
  tipo_luminaria: '',
  potencia: '',
  data_instalacao: '',
}

interface PosteFormProps {
  token: string
  onSaved: () => void
  onCancel: () => void
}

export function PosteForm({ token, onSaved, onCancel }: PosteFormProps) {
  const [formData, setFormData] = useState<PosteFormData>(INITIAL_STATE)
  const [errors, setErrors] = useState<PosteFormErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  function validate(): PosteFormErrors {
    const newErrors: PosteFormErrors = {}

    if (!formData.codigo.trim()) {
      newErrors.codigo = 'Codigo e obrigatorio'
    }

    if (formData.latitude !== '' && formData.longitude === '') {
      newErrors.longitude = 'Longitude e obrigatoria quando informa latitude'
    }

    if (formData.longitude !== '' && formData.latitude === '') {
      newErrors.latitude = 'Latitude e obrigatoria quando informa longitude'
    }

    if (formData.latitude !== '') {
      const lat = parseFloat(formData.latitude)
      if (isNaN(lat) || lat < -90 || lat > 90) {
        newErrors.latitude = 'Latitude invalida (use -90 a 90)'
      }
    }

    if (formData.longitude !== '') {
      const lng = parseFloat(formData.longitude)
      if (isNaN(lng) || lng < -180 || lng > 180) {
        newErrors.longitude = 'Longitude invalida (use -180 a 180)'
      }
    }

    if (formData.potencia !== '') {
      const pot = parseInt(formData.potencia)
      if (isNaN(pot) || pot <= 0) {
        newErrors.potencia = 'Potencia deve ser um numero positivo'
      }
    }

    return newErrors
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
      const body: Record<string, unknown> = {
        codigo: formData.codigo.trim(),
        endereco: formData.endereco.trim() || null,
        tipo_luminaria: formData.tipo_luminaria || null,
        potencia: formData.potencia ? parseInt(formData.potencia) : null,
        data_instalacao: formData.data_instalacao || null,
      }

      if (formData.latitude !== '' && formData.longitude !== '') {
        body.latitude = parseFloat(formData.latitude)
        body.longitude = parseFloat(formData.longitude)
      }

      const response = await fetch(`${API_URL}/api/postes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Erro ao cadastrar poste')
      }

      setSaved(true)
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Erro ao conectar com o servidor'
      )
    } finally {
      setSubmitting(false)
    }
  }

  function handleChange(field: keyof PosteFormData, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field as keyof PosteFormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  function handleLocationSelect(lat: number, lng: number) {
    setFormData((prev) => ({
      ...prev,
      latitude: lat.toFixed(8),
      longitude: lng.toFixed(8),
    }))
  }

  if (saved) {
    return (
      <div className={styles.success}>
        <h3>Poste cadastrado com sucesso!</h3>
        <p>Codigo: {formData.codigo}</p>
        <button className={styles.button} onClick={onSaved}>
          Cadastrar novo poste
        </button>
        <button
          className={`${styles.button} ${styles.buttonSecondary}`}
          onClick={onCancel}
          style={{ marginLeft: 8 }}
        >
          Voltar para listagem
        </button>
      </div>
    )
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.section}>
        <h3>Dados do Poste</h3>
        <div className={styles.fields}>
          <div className={styles.field}>
            <label htmlFor="codigo">Codigo *</label>
            <input
              id="codigo"
              type="text"
              value={formData.codigo}
              onChange={(e) => handleChange('codigo', e.target.value)}
              placeholder="Ex: POSTE-00123"
              disabled={submitting}
            />
            {errors.codigo && <span className={styles.error}>{errors.codigo}</span>}
          </div>

          <div className={styles.field}>
            <label htmlFor="tipo_luminaria">Tipo de Luminaria</label>
            <select
              id="tipo_luminaria"
              value={formData.tipo_luminaria}
              onChange={(e) => handleChange('tipo_luminaria', e.target.value)}
              disabled={submitting}
            >
              <option value="">Selecione...</option>
              {TIPOS_LUMINARIA.map((tipo) => (
                <option key={tipo.value} value={tipo.value}>
                  {tipo.label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label htmlFor="potencia">Potencia (W)</label>
            <input
              id="potencia"
              type="number"
              value={formData.potencia}
              onChange={(e) => handleChange('potencia', e.target.value)}
              placeholder="Ex: 150"
              min="0"
              disabled={submitting}
            />
            {errors.potencia && <span className={styles.error}>{errors.potencia}</span>}
          </div>

          <div className={styles.field}>
            <label htmlFor="data_instalacao">Data de Instalacao</label>
            <input
              id="data_instalacao"
              type="date"
              value={formData.data_instalacao}
              onChange={(e) => handleChange('data_instalacao', e.target.value)}
              disabled={submitting}
            />
          </div>

          <div className={`${styles.field} ${styles.fieldFull}`}>
            <label htmlFor="endereco">Endereco</label>
            <input
              id="endereco"
              type="text"
              value={formData.endereco}
              onChange={(e) => handleChange('endereco', e.target.value)}
              placeholder="Rua, numero, bairro"
              disabled={submitting}
            />
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <h3>Localizacao</h3>
        <div className={styles.fields}>
          <div className={styles.field}>
            <label htmlFor="latitude">Latitude</label>
            <input
              id="latitude"
              type="text"
              value={formData.latitude}
              onChange={(e) => handleChange('latitude', e.target.value)}
              placeholder="-3.4653"
              disabled={submitting}
            />
            {errors.latitude && <span className={styles.error}>{errors.latitude}</span>}
          </div>

          <div className={styles.field}>
            <label htmlFor="longitude">Longitude</label>
            <input
              id="longitude"
              type="text"
              value={formData.longitude}
              onChange={(e) => handleChange('longitude', e.target.value)}
              placeholder="-62.2159"
              disabled={submitting}
            />
            {errors.longitude && <span className={styles.error}>{errors.longitude}</span>}
          </div>
        </div>

        <div className={styles.mapSection}>
          <MapPicker
            latitude={formData.latitude !== '' ? parseFloat(formData.latitude) : null}
            longitude={formData.longitude !== '' ? parseFloat(formData.longitude) : null}
            onLocationSelect={handleLocationSelect}
          />
        </div>
      </div>

      {submitError && <p className={styles.error}>{submitError}</p>}

      <div className={styles.actions}>
        <button
          type="button"
          className={`${styles.button} ${styles.buttonSecondary}`}
          onClick={onCancel}
          disabled={submitting}
        >
          Cancelar
        </button>
        <button
          type="submit"
          className={`${styles.button} ${styles.buttonPrimary}`}
          disabled={submitting}
        >
          {submitting ? 'Salvando...' : 'Cadastrar Poste'}
        </button>
      </div>
    </form>
  )
}
