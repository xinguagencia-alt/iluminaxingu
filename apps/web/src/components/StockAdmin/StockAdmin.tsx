import { useState } from 'react'
import { useEstoque, type ItemEstoque, type MovimentacaoEstoque } from '../../hooks/useEstoque'
import styles from './StockAdmin.module.css'

type Tab = 'config' | 'itens' | 'movimentacoes' | 'resumo'

const CATEGORIAS = ['Material', 'Lampada', 'Rele', 'Reator', 'Braco', 'Conector', 'Cabo', 'Fusivel', 'Outros']
const UNIDADES = ['un', 'par', 'kg', 'm', 'cx', 'pct', 'rolo', 'l']
const TIPOS_MOVIMENTO: Record<string, string> = {
  entrada: 'Entrada',
  saida: 'Saida',
  ajuste: 'Ajuste',
  baixa_os: 'Baixa por OS',
}

function formatDate(dateString: string | null): string {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  return (
    <div className={`${styles.toast} ${type === 'error' ? styles.toastError : styles.toastSuccess}`}>
      <span>{message}</span>
      <button className={styles.toastClose} onClick={onClose}>×</button>
    </div>
  )
}

function ConfigTab({ config, toggleEstoque }: { config: Record<string, string>; toggleEstoque: (a: boolean) => Promise<boolean> }) {
  const [saving, setSaving] = useState(false)
  const ativo = config.estoque_ativo === 'true'

  async function handleToggle() {
    setSaving(true)
    await toggleEstoque(!ativo)
    setSaving(false)
  }

  return (
    <div className={styles.configSection}>
      <div className={styles.configCard}>
        <div className={styles.configInfo}>
          <h3>Modulo de Estoque</h3>
          <p>{ativo ? 'O modulo esta habilitado. O sistema controla entrada, saida e baixa de materiais automaticamente.' : 'O modulo esta desabilitado. Nenhuma movimentacao de estoque e registrada.'}</p>
        </div>
        <button
          className={`${styles.toggleBtn} ${ativo ? styles.toggleActive : ''}`}
          onClick={handleToggle}
          disabled={saving}
        >
          {saving ? 'Salvando...' : ativo ? 'Desabilitar' : 'Habilitar'}
        </button>
      </div>
    </div>
  )
}

function ItensTab({ itens, criarItem, atualizarItem, excluirItem }: {
  itens: ItemEstoque[];
  criarItem: (d: Partial<ItemEstoque>) => Promise<boolean>;
  atualizarItem: (id: number, d: Partial<ItemEstoque>) => Promise<boolean>;
  excluirItem: (id: number) => Promise<boolean>;
}) {
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<ItemEstoque | null>(null)
  const [form, setForm] = useState({ nome: '', categoria: 'Material', unidade_medida: 'un', estoque_minimo: '0', estoque_atual: '0', observacao: '', codigo_interno: '' })
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  function resetForm() {
    setForm({ nome: '', categoria: 'Material', unidade_medida: 'un', estoque_minimo: '0', estoque_atual: '0', observacao: '', codigo_interno: '' })
    setEditing(null)
    setShowForm(false)
  }

  function startEdit(item: ItemEstoque) {
    setForm({
      nome: item.nome,
      categoria: item.categoria,
      unidade_medida: item.unidade_medida,
      estoque_minimo: String(item.estoque_minimo),
      estoque_atual: String(item.estoque_atual),
      observacao: item.observacao || '',
      codigo_interno: item.codigo_interno || '',
    })
    setEditing(item)
    setShowForm(true)
  }

  async function handleSubmit() {
    if (!form.nome.trim()) {
      showToast('Nome e obrigatorio', 'error')
      return
    }
    setSaving(true)
    const dados = {
      ...form,
      estoque_minimo: Number(form.estoque_minimo),
      estoque_atual: Number(form.estoque_atual),
      observacao: form.observacao || null,
      codigo_interno: form.codigo_interno || null,
    }
    const ok = editing ? await atualizarItem(editing.id, dados) : await criarItem(dados)
    setSaving(false)
    if (ok) {
      showToast(editing ? 'Item atualizado' : 'Item criado', 'success')
      resetForm()
    } else {
      showToast('Erro ao salvar item', 'error')
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Excluir este item?')) return
    const ok = await excluirItem(id)
    if (ok) showToast('Item excluido', 'success')
    else showToast('Erro ao excluir', 'error')
  }

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className={styles.toolbar}>
        <span className={styles.count}>{itens.length} item(ns) cadastrado(s)</span>
        <button className={styles.primaryBtn} onClick={() => { resetForm(); setShowForm(true) }}>
          Novo Item
        </button>
      </div>

      {showForm && (
        <div className={styles.formCard}>
          <h4>{editing ? 'Editar Item' : 'Novo Item'}</h4>
          <div className={styles.formGrid}>
            <div className={styles.formField}>
              <label>Nome *</label>
              <input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Lampada LED 150W" />
            </div>
            <div className={styles.formField}>
              <label>Codigo Interno</label>
              <input value={form.codigo_interno} onChange={e => setForm({ ...form, codigo_interno: e.target.value })} placeholder="Ex: LAMP-001" />
            </div>
            <div className={styles.formField}>
              <label>Categoria *</label>
              <select value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}>
                {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className={styles.formField}>
              <label>Unidade *</label>
              <select value={form.unidade_medida} onChange={e => setForm({ ...form, unidade_medida: e.target.value })}>
                {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className={styles.formField}>
              <label>Estoque Minimo</label>
              <input type="number" min="0" value={form.estoque_minimo} onChange={e => setForm({ ...form, estoque_minimo: e.target.value })} />
            </div>
            <div className={styles.formField}>
              <label>Estoque Atual</label>
              <input type="number" min="0" value={form.estoque_atual} onChange={e => setForm({ ...form, estoque_atual: e.target.value })} />
            </div>
            <div className={`${styles.formField} ${styles.formFull}`}>
              <label>Observacao</label>
              <textarea rows={2} value={form.observacao} onChange={e => setForm({ ...form, observacao: e.target.value })} />
            </div>
          </div>
          <div className={styles.formActions}>
            <button className={styles.cancelBtn} onClick={resetForm}>Cancelar</button>
            <button className={styles.primaryBtn} onClick={handleSubmit} disabled={saving}>
              {saving ? 'Salvando...' : editing ? 'Salvar' : 'Criar'}
            </button>
          </div>
        </div>
      )}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Cod.</th>
              <th>Nome</th>
              <th>Categoria</th>
              <th>Unidade</th>
              <th>Min.</th>
              <th>Atual</th>
              <th>Status</th>
              <th>Acoes</th>
            </tr>
          </thead>
          <tbody>
            {itens.map(item => (
              <tr key={item.id} className={!item.ativo ? styles.rowInactive : ''}>
                <td className={styles.codeCell}>{item.codigo_interno || '-'}</td>
                <td>{item.nome}</td>
                <td><span className={styles.catBadge}>{item.categoria}</span></td>
                <td>{item.unidade_medida}</td>
                <td>{item.estoque_minimo}</td>
                <td className={Number(item.estoque_atual) <= Number(item.estoque_minimo) ? styles.stockLow : ''}>
                  {item.estoque_atual}
                </td>
                <td>
                  <span className={`${styles.statusBadge} ${item.ativo ? styles.statusActive : styles.statusInactive}`}>
                    {item.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td>
                  <div className={styles.actions}>
                    <button className={styles.editBtn} onClick={() => startEdit(item)} title="Editar">Editar</button>
                    <button className={styles.deleteBtn} onClick={() => handleDelete(item.id)} title="Excluir">Excluir</button>
                  </div>
                </td>
              </tr>
            ))}
            {itens.length === 0 && (
              <tr><td colSpan={8} className={styles.empty}>Nenhum item cadastrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function MovimentacoesTab({ movimentacoes, itens, criarMovimentacao }: {
  movimentacoes: MovimentacaoEstoque[];
  itens: ItemEstoque[];
  criarMovimentacao: (d: { item_id: number; tipo: string; quantidade: number; observacao?: string; os_id?: number; nota_fiscal?: string; fornecedor?: string; data_movimento?: string }) => Promise<boolean>;
}) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ item_id: '', tipo: 'entrada', quantidade: '', observacao: '', os_id: '', nota_fiscal: '', fornecedor: '', data_movimento: '' })
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  async function handleSubmit() {
    if (!form.item_id || !form.quantidade) {
      showToast('Item e quantidade sao obrigatorios', 'error')
      return
    }
    setSaving(true)
    const ok = await criarMovimentacao({
      item_id: Number(form.item_id),
      tipo: form.tipo,
      quantidade: Number(form.quantidade),
      observacao: form.observacao || undefined,
      os_id: form.os_id ? Number(form.os_id) : undefined,
      nota_fiscal: form.nota_fiscal || undefined,
      fornecedor: form.fornecedor || undefined,
      data_movimento: form.data_movimento || undefined,
    })
    setSaving(false)
    if (ok) {
      showToast('Movimentacao registrada', 'success')
      setForm({ item_id: '', tipo: 'entrada', quantidade: '', observacao: '', os_id: '', nota_fiscal: '', fornecedor: '', data_movimento: '' })
      setShowForm(false)
    } else {
      showToast('Erro ao registrar movimentacao', 'error')
    }
  }

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className={styles.toolbar}>
        <span className={styles.count}>{movimentacoes.length} movimentacao(oe)s</span>
        <button className={styles.primaryBtn} onClick={() => setShowForm(!showForm)}>
          Nova Movimentacao
        </button>
      </div>

      {showForm && (
        <div className={styles.formCard}>
          <h4>Nova Movimentacao</h4>
          <div className={styles.formGrid}>
            <div className={styles.formField}>
              <label>Item *</label>
              <select value={form.item_id} onChange={e => setForm({ ...form, item_id: e.target.value })}>
                <option value="">Selecione...</option>
                {itens.filter(i => i.ativo).map(i => (
                  <option key={i.id} value={i.id}>{i.nome} ({i.unidade_medida})</option>
                ))}
              </select>
            </div>
            <div className={styles.formField}>
              <label>Tipo *</label>
              <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
                <option value="entrada">Entrada</option>
                <option value="saida">Saida</option>
                <option value="ajuste">Ajuste</option>
              </select>
            </div>
            <div className={styles.formField}>
              <label>Quantidade *</label>
              <input type="number" min="0" step="0.01" value={form.quantidade} onChange={e => setForm({ ...form, quantidade: e.target.value })} />
            </div>
            <div className={styles.formField}>
              <label>Data</label>
              <input type="datetime-local" value={form.data_movimento} onChange={e => setForm({ ...form, data_movimento: e.target.value })} />
            </div>
            {form.tipo === 'entrada' && (
              <>
                <div className={styles.formField}>
                  <label>Nota Fiscal</label>
                  <input value={form.nota_fiscal} onChange={e => setForm({ ...form, nota_fiscal: e.target.value })} />
                </div>
                <div className={styles.formField}>
                  <label>Fornecedor</label>
                  <input value={form.fornecedor} onChange={e => setForm({ ...form, fornecedor: e.target.value })} />
                </div>
              </>
            )}
            {form.tipo === 'saida' && (
              <div className={styles.formField}>
                <label>OS Vinculada</label>
                <input type="number" value={form.os_id} onChange={e => setForm({ ...form, os_id: e.target.value })} />
              </div>
            )}
            <div className={`${styles.formField} ${styles.formFull}`}>
              <label>Observacao</label>
              <textarea rows={2} value={form.observacao} onChange={e => setForm({ ...form, observacao: e.target.value })} />
            </div>
          </div>
          <div className={styles.formActions}>
            <button className={styles.cancelBtn} onClick={() => setShowForm(false)}>Cancelar</button>
            <button className={styles.primaryBtn} onClick={handleSubmit} disabled={saving}>
              {saving ? 'Salvando...' : 'Registrar'}
            </button>
          </div>
        </div>
      )}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Data</th>
              <th>Item</th>
              <th>Tipo</th>
              <th>Qtd</th>
              <th>Saldo Ant.</th>
              <th>Saldo Post.</th>
              <th>OS</th>
              <th>Nota Fiscal</th>
              <th>Usuario</th>
            </tr>
          </thead>
          <tbody>
            {movimentacoes.map(m => (
              <tr key={m.id}>
                <td>{formatDate(m.data_movimento)}</td>
                <td>{m.item_nome}</td>
                <td>
                  <span className={`${styles.tipoBadge} ${styles[`tipo_${m.tipo}`]}`}>
                    {TIPOS_MOVIMENTO[m.tipo] || m.tipo}
                  </span>
                </td>
                <td>{m.quantidade} {m.unidade_medida}</td>
                <td>{m.saldo_anterior}</td>
                <td>{m.saldo_posterior}</td>
                <td>{m.os_id || '-'}</td>
                <td>{m.nota_fiscal || '-'}</td>
                <td>{m.usuario || '-'}</td>
              </tr>
            ))}
            {movimentacoes.length === 0 && (
              <tr><td colSpan={9} className={styles.empty}>Nenhuma movimentacao registrada.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ResumoTab({ itens, movimentacoes }: { itens: ItemEstoque[]; movimentacoes: MovimentacaoEstoque[] }) {
  const itensAbaixoMinimo = itens.filter(i => i.ativo && Number(i.estoque_atual) <= Number(i.estoque_minimo))
  const itensInativos = itens.filter(i => !i.ativo)
  const entradas = movimentacoes.filter(m => m.tipo === 'entrada')
  const saidas = movimentacoes.filter(m => m.tipo === 'saida' || m.tipo === 'baixa_os')
  const totalEntradas = entradas.reduce((sum, m) => sum + Number(m.quantidade), 0)
  const totalSaidas = saidas.reduce((sum, m) => sum + Number(m.quantidade), 0)

  return (
    <div>
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{itens.filter(i => i.ativo).length}</span>
          <span className={styles.statLabel}>Itens Ativos</span>
        </div>
        <div className={styles.statCard}>
          <span className={`${styles.statValue} ${itensAbaixoMinimo.length > 0 ? styles.statDanger : ''}`}>{itensAbaixoMinimo.length}</span>
          <span className={styles.statLabel}>Abaixo do Minimo</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{totalEntradas}</span>
          <span className={styles.statLabel}>Total Entradas</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{totalSaidas}</span>
          <span className={styles.statLabel}>Total Saidas</span>
        </div>
      </div>

      {itensAbaixoMinimo.length > 0 && (
        <div className={styles.warningSection}>
          <h4>Itens abaixo do estoque minimo</h4>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Estoque Atual</th>
                  <th>Estoque Minimo</th>
                  <th>Deficit</th>
                </tr>
              </thead>
              <tbody>
                {itensAbaixoMinimo.map(item => (
                  <tr key={item.id}>
                    <td>{item.nome}</td>
                    <td className={styles.stockLow}>{item.estoque_atual} {item.unidade_medida}</td>
                    <td>{item.estoque_minimo} {item.unidade_medida}</td>
                    <td className={styles.stockLow}>{Number(item.estoque_minimo) - Number(item.estoque_atual)} {item.unidade_medida}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {itensInativos.length > 0 && (
        <div className={styles.infoSection}>
          <h4>Itens inativos ({itensInativos.length})</h4>
          <div className={styles.inactiveList}>
            {itensInativos.map(item => (
              <span key={item.id} className={styles.inactiveTag}>{item.nome}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function StockAdmin() {
  const { config, itens, movimentacoes, loading, error, toggleEstoque, criarItem, atualizarItem, excluirItem, criarMovimentacao } = useEstoque()
  const [tab, setTab] = useState<Tab>('resumo')
  const ativo = config.estoque_ativo === 'true'

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <div>
            <h2>Controle de Estoque</h2>
            <p className={styles.subtitle}>Gerencie materiais de iluminacao publica, entradas, saidas e saldos.</p>
          </div>
          <div className={`${styles.statusIndicator} ${ativo ? styles.statusOn : styles.statusOff}`}>
            <span className={styles.statusDot} />
            {ativo ? 'Ativo' : 'Inativo'}
          </div>
        </div>
      </div>

      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === 'resumo' ? styles.tabActive : ''}`} onClick={() => setTab('resumo')}>Resumo</button>
        <button className={`${styles.tab} ${tab === 'itens' ? styles.tabActive : ''}`} onClick={() => setTab('itens')}>Itens</button>
        <button className={`${styles.tab} ${tab === 'movimentacoes' ? styles.tabActive : ''}`} onClick={() => setTab('movimentacoes')}>Movimentacoes</button>
        <button className={`${styles.tab} ${tab === 'config' ? styles.tabActive : ''}`} onClick={() => setTab('config')}>Configuracao</button>
      </div>

      <div className={styles.content}>
        {loading ? (
          <div className={styles.loading}>Carregando...</div>
        ) : error ? (
          <div className={styles.error}>{error}</div>
        ) : (
          <>
            {tab === 'config' && <ConfigTab config={config} toggleEstoque={toggleEstoque} />}
            {tab === 'itens' && <ItensTab itens={itens} criarItem={criarItem} atualizarItem={atualizarItem} excluirItem={excluirItem} />}
            {tab === 'movimentacoes' && <MovimentacoesTab movimentacoes={movimentacoes} itens={itens} criarMovimentacao={criarMovimentacao} />}
            {tab === 'resumo' && <ResumoTab itens={itens} movimentacoes={movimentacoes} />}
          </>
        )}
      </div>
    </div>
  )
}
