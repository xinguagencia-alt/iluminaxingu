import { useState } from 'react'

type PortalCard = {
  key: string
  icon: string
  title: string
  description: string
  active: boolean
}

const PORTAIS: PortalCard[] = [
  {
    key: 'iluminacao',
    icon: '💡',
    title: 'Iluminação Pública',
    description: 'Solicite reparos em lâmpadas, postes e outros problemas de iluminação pública.',
    active: true,
  },
  {
    key: 'obras',
    icon: '🛣️',
    title: 'Secretaria Municipal de Obras',
    description: 'Registre problemas em estradas, pontes, vicinais, bueiros e infraestrutura rural.',
    active: false,
  },
  {
    key: 'saude',
    icon: '🏥',
    title: 'Secretaria Municipal de Saúde',
    description: 'Em breve, um canal digital para solicitações e serviços da Secretaria de Saúde.',
    active: false,
  },
  {
    key: 'urbanismo',
    icon: '🏙️',
    title: 'Secretaria Municipal de Urbanismo',
    description: 'Em breve, serviços relacionados ao urbanismo, limpeza e conservação da cidade.',
    active: false,
  },
]

function navegar(path: string) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export function PortalHome() {
  const [aviso, setAviso] = useState<string | null>(null)

  function selecionar(portal: PortalCard) {
    if (portal.active) {
      navegar('/prefeitura/iluminacao')
      return
    }
    setAviso(`${portal.title} estará disponível em uma próxima etapa.`)
  }

  return (
    <div className="portalHome">
      <header className="portalHomeHeader">
        <div className="portalHomeMark" aria-hidden="true">IX</div>
        <div>
          <span className="portalHomeEyebrow">Gestão Municipal</span>
          <h1>Painel da Prefeitura</h1>
          <p>Escolha a secretaria para acessar o módulo administrativo correspondente.</p>
        </div>
      </header>

      <main className="portalHomeMain">
        <section className="portalHomeIntro" aria-labelledby="portal-home-title">
          <span className="portalHomeKicker">Módulos administrativos</span>
          <h2 id="portal-home-title">Escolha uma secretaria</h2>
          <p>Selecione uma área da Prefeitura para entrar no painel de gestão.</p>
        </section>

        <section className="portalCards" aria-label="Secretarias e serviços">
          {PORTAIS.map((portal) => (
            <button
              type="button"
              key={portal.key}
              className={`portalCard ${portal.active ? 'portalCardActive' : 'portalCardSoon'}`}
              onClick={() => selecionar(portal)}
              aria-label={`${portal.title}${portal.active ? '' : ' em breve'}`}
            >
              <span className="portalCardIcon" aria-hidden="true">{portal.icon}</span>
              <span className="portalCardContent">
                <span className="portalCardTitle">{portal.title}</span>
                <span className="portalCardDescription">{portal.description}</span>
              </span>
              <span className="portalCardAction">{portal.active ? 'Acessar →' : 'Em breve'}</span>
            </button>
          ))}
        </section>

        {aviso && (
          <div className="portalHomeNotice" role="status" aria-live="polite">
            <span>{aviso}</span>
            <button type="button" onClick={() => setAviso(null)} aria-label="Fechar aviso">×</button>
          </div>
        )}

        <p className="portalHomeFooterText">
          Um único painel para organizar a gestão dos serviços públicos municipais.
        </p>
      </main>
    </div>
  )
}
