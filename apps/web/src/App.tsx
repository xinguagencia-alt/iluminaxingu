import { useState, useEffect, Component, type ReactNode } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { RequestForm } from './components/RequestForm/RequestForm'
import { SolicitacaoList } from './components/SolicitacaoList/SolicitacaoList'
import { PosteList } from './components/PosteList/PosteList'
import { PosteForm } from './components/PosteForm/PosteForm'
import { Poste } from './components/PosteForm/types'
import { LoginForm } from './components/LoginForm/LoginForm'
import { BootstrapForm } from './components/BootstrapForm/BootstrapForm'
import { Dashboard } from './components/Dashboard/Dashboard'
import { OrdemServicoList } from './components/OrdemServicoList/OrdemServicoList'
import { OrdemServicoDetail } from './components/OrdemServicoDetail/OrdemServicoDetail'
import { EquipeList } from './components/EquipeList/EquipeList'
import { SolicitacaoPublica } from './components/SolicitacaoPublica/SolicitacaoPublica'
import { UserManagement } from './components/UserManagement/UserManagement'
import { LogradouroManager } from './components/LogradouroManager/LogradouroManager'
import { AdminPanel } from './components/AdminPanel/AdminPanel'
import { MapaPostes } from './components/MapaPostes/MapaPostes'

type Page = 'home' | 'consultar' | 'dashboard' | 'admin' | 'postes' | 'postes-novo' | 'postes-editar' | 'ordens' | 'ordem-detail' | 'equipes' | 'usuarios' | 'logradouros' | 'sistema' | 'mapa'

const ADMIN_PAGE_HINTS: Record<Page, string> = {
  home: '',
  consultar: '',
  dashboard: 'Resumo geral com indicadores e atalhos de operacao.',
  admin: 'Acompanhe chamados, filtre prioridades e gere ordens de servico.',
  postes: 'Consulte e mantenha o cadastro dos postes atualizado.',
  'postes-novo': 'Preencha os dados do novo poste antes de salvar.',
  'postes-editar': 'Revise as informacoes do poste e confirme as alteracoes.',
  ordens: 'Gerencie as ordens abertas e acompanhe a execucao em campo.',
  'ordem-detail': 'Veja os detalhes da ordem e finalize o atendimento com seguranca.',
  equipes: 'Organize as equipes responsaveis pelos atendimentos.',
  usuarios: 'Controle quem acessa o painel e qual perfil cada colaborador possui.',
  logradouros: 'Padronize bairros, ruas e avenidas para relatorios mais confiaveis.',
  sistema: 'Auditoria e exportacao de dados para administracao interna.',
  mapa: 'Visualize os postes no mapa e acompanhe a cobertura por bairro.',
}

function usePathname() {
  const [path, setPath] = useState(window.location.pathname)

  useEffect(() => {
    function onPopState() {
      setPath(window.location.pathname)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  return path
}

class ErrorBoundary extends Component<{ children: ReactNode; onReset?: () => void }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <h2 style={{ color: '#dc2626' }}>Algo deu errado</h2>
          <p style={{ color: '#6b7280' }}>{this.state.error.message}</p>
          <button
            onClick={() => {
              this.setState({ error: null })
              this.props.onReset?.()
            }}
            style={{
              marginTop: 16, padding: '10px 20px', background: '#f59e0b',
              color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer',
            }}
          >
            Tentar novamente
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

function AppBrand({
  title,
  subtitle,
  eyebrow,
}: {
  title: string
  subtitle: string
  eyebrow: string
}) {
  return (
    <div className="headerBranding">
      <div className="headerBrandMark">
        <div className="headerBrandIcon" aria-hidden="true">
          IX
        </div>
        <div className="headerTitles">
          <span className="headerEyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
      </div>
    </div>
  )
}

function PublicLayout() {
  const [currentPage, setCurrentPage] = useState<'home' | 'consultar'>('home')

  return (
    <div className="app">
      <header className="header">
        <div className="headerInner">
          <AppBrand
            title="IluminaXingu"
            subtitle="Registro digital de iluminação pública para atendimento rápido e rastreável."
            eyebrow="Portal do Munícipe"
          />
        </div>
        <nav className="nav" aria-label="Navegacao principal do municipe">
          <button
            className={`navButton ${currentPage === 'home' ? 'navButtonActive' : ''}`}
            onClick={() => setCurrentPage('home')}
            aria-current={currentPage === 'home' ? 'page' : undefined}
          >
            Nova solicitação
          </button>
          <button
            className={`navButton ${currentPage === 'consultar' ? 'navButtonActive' : ''}`}
            onClick={() => setCurrentPage('consultar')}
            aria-current={currentPage === 'consultar' ? 'page' : undefined}
          >
            Consultar protocolo
          </button>
        </nav>
      </header>
      <div className="navHint">Escolha entre abrir um novo pedido ou consultar um protocolo já existente.</div>
      <main className="main">
        {currentPage === 'home' && <RequestForm />}
        {currentPage === 'consultar' && (
          <SolicitacaoPublica onVoltar={() => setCurrentPage('home')} />
        )}
      </main>
      <footer className="footer">
        <img src="/logo.png" alt="Xingu Marketing & Publicidade" className="footerLogo" />
      </footer>
    </div>
  )
}

function AdminLayout() {
  const { user, logout, loading, needsBootstrap, token } = useAuth()
  const [currentPage, setCurrentPage] = useState<Page>('dashboard')
  const [selectedOrdemId, setSelectedOrdemId] = useState<number | null>(null)
  const [editingPoste, setEditingPoste] = useState<Poste | null>(null)

  function handleLogout() {
    logout()
    setCurrentPage('dashboard')
  }

  if (loading) {
    return (
      <div className="app">
        <header className="header">
          <div className="headerInner">
            <AppBrand
              title="IluminaXingu"
              subtitle="Centro administrativo para operação, controle e indicadores da iluminação pública."
              eyebrow="Painel Administrativo"
            />
          </div>
        </header>
        <main className="main">
          <div className="emptyStateMessage">Carregando...</div>
        </main>
      </div>
    )
  }

  if (needsBootstrap) {
    return (
      <div className="app">
        <header className="header">
          <div className="headerInner">
            <AppBrand
              title="IluminaXingu"
              subtitle="Configuração inicial segura do ambiente administrativo."
              eyebrow="Painel Administrativo"
            />
          </div>
        </header>
        <main className="main">
          <BootstrapForm />
        </main>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="app">
        <header className="header">
          <div className="headerInner">
            <AppBrand
              title="IluminaXingu"
              subtitle="Acesso protegido para gestão, atendimento e acompanhamento operacional."
              eyebrow="Painel Administrativo"
            />
          </div>
        </header>
        <main className="main">
          <LoginForm />
        </main>
        <footer className="footer">
          <img src="/logo.png" alt="Xingu Marketing & Publicidade" className="footerLogo" />
        </footer>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="header">
        <div className="headerInner">
          <AppBrand
            title="IluminaXingu"
            subtitle="Painel operacional com solicitações, equipes, ordens, mapa e controle de ativos."
            eyebrow="Painel Administrativo"
          />
        </div>
        <nav className="nav" aria-label="Navegacao principal da prefeitura">
          <button
            className={`navButton ${currentPage === 'dashboard' ? 'navButtonActive' : ''}`}
            onClick={() => setCurrentPage('dashboard')}
            aria-current={currentPage === 'dashboard' ? 'page' : undefined}
          >
            Painel
          </button>
          <button
            className={`navButton ${currentPage === 'admin' ? 'navButtonActive' : ''}`}
            onClick={() => setCurrentPage('admin')}
            aria-current={currentPage === 'admin' ? 'page' : undefined}
          >
            Solicitações
          </button>
          <button
            className={`navButton ${currentPage === 'postes' || currentPage === 'postes-novo' || currentPage === 'postes-editar' ? 'navButtonActive' : ''}`}
            onClick={() => setCurrentPage('postes')}
            aria-current={currentPage === 'postes' || currentPage === 'postes-novo' || currentPage === 'postes-editar' ? 'page' : undefined}
          >
            Postes
          </button>
          <button
            className={`navButton ${currentPage === 'ordens' ? 'navButtonActive' : ''}`}
            onClick={() => setCurrentPage('ordens')}
            aria-current={currentPage === 'ordens' ? 'page' : undefined}
          >
            Ordens
          </button>
          <button
            className={`navButton ${currentPage === 'equipes' ? 'navButtonActive' : ''}`}
            onClick={() => setCurrentPage('equipes')}
            aria-current={currentPage === 'equipes' ? 'page' : undefined}
          >
            Equipes
          </button>
          <button
            className={`navButton ${currentPage === 'logradouros' ? 'navButtonActive' : ''}`}
            onClick={() => setCurrentPage('logradouros')}
            aria-current={currentPage === 'logradouros' ? 'page' : undefined}
          >
            Logradouros
          </button>
          <button
            className={`navButton ${currentPage === 'mapa' ? 'navButtonActive' : ''}`}
            onClick={() => setCurrentPage('mapa')}
            aria-current={currentPage === 'mapa' ? 'page' : undefined}
          >
            Mapa
          </button>
          {user.perfil === 'admin' && (
            <button
              className={`navButton ${currentPage === 'usuarios' ? 'navButtonActive' : ''}`}
              onClick={() => setCurrentPage('usuarios')}
              aria-current={currentPage === 'usuarios' ? 'page' : undefined}
            >
              Usuários
            </button>
          )}
          {user.perfil === 'admin' && (
            <button
              className={`navButton ${currentPage === 'sistema' ? 'navButtonActive' : ''}`}
              onClick={() => setCurrentPage('sistema')}
              aria-current={currentPage === 'sistema' ? 'page' : undefined}
            >
              Sistema
            </button>
          )}
          <div className="userInfo">
            <span className="userName">{user.nomeCompleto}</span>
            <button className="navButton" onClick={handleLogout}>
              Sair
            </button>
          </div>
        </nav>
      </header>
      <div className="navHint">{ADMIN_PAGE_HINTS[currentPage]}</div>
      <main className="main">
        <ErrorBoundary key={currentPage} onReset={() => setCurrentPage('dashboard')}>
          {currentPage === 'dashboard' && <Dashboard />}
          {currentPage === 'admin' && <SolicitacaoList />}
          {currentPage === 'ordens' && (
            <OrdemServicoList
              onDetalhes={(id) => {
                setSelectedOrdemId(id)
                setCurrentPage('ordem-detail')
              }}
            />
          )}
          {currentPage === 'ordem-detail' && selectedOrdemId && (
            <OrdemServicoDetail
              ordemId={selectedOrdemId}
              onVoltar={() => {
                setSelectedOrdemId(null)
                setCurrentPage('ordens')
              }}
            />
          )}
          {currentPage === 'equipes' && <EquipeList />}
          {currentPage === 'usuarios' && user.perfil === 'admin' && <UserManagement />}
          {currentPage === 'sistema' && user.perfil === 'admin' && <AdminPanel />}
          {currentPage === 'logradouros' && <LogradouroManager />}
          {currentPage === 'mapa' && <MapaPostes />}
          {currentPage === 'postes' && (
            <PosteList
              onNovoPoste={() => setCurrentPage('postes-novo')}
              onEditar={(poste) => {
                setEditingPoste(poste)
                setCurrentPage('postes-editar')
              }}
            />
          )}
          {currentPage === 'postes-novo' && (
            <PosteForm
              token={token!}
              onSaved={() => setCurrentPage('postes')}
              onCancel={() => setCurrentPage('postes')}
            />
          )}
          {currentPage === 'postes-editar' && editingPoste && (
            <PosteForm
              token={token!}
              editId={editingPoste.id}
              initialData={{
                codigo: editingPoste.codigo,
                rua: editingPoste.rua || '',
                numero: editingPoste.numero || '',
                bairro: editingPoste.bairro || '',
                complemento: editingPoste.complemento || '',
                latitude: editingPoste.latitude != null ? String(editingPoste.latitude) : '',
                longitude: editingPoste.longitude != null ? String(editingPoste.longitude) : '',
                tipo_luminaria: editingPoste.tipo_luminaria || '',
                potencia: editingPoste.potencia != null ? String(editingPoste.potencia) : '',
                data_instalacao: editingPoste.data_instalacao || '',
              }}
              submitLabel="Salvar Alteracoes"
              onSaved={() => {
                setEditingPoste(null)
                setCurrentPage('postes')
              }}
              onCancel={() => {
                setEditingPoste(null)
                setCurrentPage('postes')
              }}
            />
          )}
        </ErrorBoundary>
      </main>
      <footer className="footer">
        <img src="/logo.png" alt="Xingu Marketing & Publicidade" className="footerLogo" />
      </footer>
    </div>
  )
}

function AppRoutes() {
  const path = usePathname()

  if (path.startsWith('/prefeitura')) {
    return <AdminLayout />
  }

  return <PublicLayout />
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}

export default App




