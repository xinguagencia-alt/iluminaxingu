import { useRef, useState } from 'react'
import styles from './FileUpload.module.css'

interface FileUploadProps {
  onUpload: (file: File) => Promise<boolean>
  uploading: boolean
  disabled?: boolean
}

export function FileUpload({ onUpload, uploading, disabled }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)

    if (file.size > 10 * 1024 * 1024) {
      setError('Arquivo muito grande (maximo 10MB)')
      return
    }

    setSelectedFile(file)
  }

  async function handleUpload() {
    if (!selectedFile) return

    const success = await onUpload(selectedFile)
    if (success) {
      setSelectedFile(null)
      if (inputRef.current) inputRef.current.value = ''
    } else {
      setError('Erro ao enviar arquivo')
    }
  }

  function handleClear() {
    setSelectedFile(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className={styles.container}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.pdf,.doc,.docx,.txt"
        onChange={handleFileChange}
        className={styles.input}
        disabled={uploading || disabled}
      />

      {selectedFile && (
        <div className={styles.preview}>
          <span className={styles.fileName}>{selectedFile.name}</span>
          <span className={styles.fileSize}>
            {selectedFile.size < 1024
              ? `${selectedFile.size} B`
              : selectedFile.size < 1024 * 1024
                ? `${(selectedFile.size / 1024).toFixed(1)} KB`
                : `${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB`}
          </span>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.uploadButton}
              onClick={handleUpload}
              disabled={uploading}
            >
              {uploading ? 'Enviando...' : 'Enviar'}
            </button>
            <button
              type="button"
              className={styles.clearButton}
              onClick={handleClear}
              disabled={uploading}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {!selectedFile && (
        <button
          type="button"
          className={styles.addButton}
          onClick={() => inputRef.current?.click()}
          disabled={uploading || disabled}
        >
          + Adicionar arquivo
        </button>
      )}

      {error && <span className={styles.error}>{error}</span>}
    </div>
  )
}
