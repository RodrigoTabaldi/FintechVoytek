import { useEffect, useRef, useState, type ReactNode } from 'react'

export type PageId =
  | 'overview' | 'agents' | 'objectives' | 'automation' | 'policies' | 'approvals'
  | 'shadow' | 'wallet' | 'ledger' | 'outcomes' | 'audit' | 'cards' | 'vault'
  | 'commerce' | 'credentials' | 'access'

type IconName = 'home' | 'search' | 'agent' | 'target' | 'automation' | 'shield' | 'check' | 'play'
  | 'wallet' | 'ledger' | 'chart' | 'audit' | 'card' | 'lock' | 'commerce' | 'key' | 'users'

const iconShapes: Record<IconName, ReactNode> = {
  home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9M9 20v-6h6v6" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m16 16 5 5" /></>,
  agent: <><rect x="4" y="7" width="16" height="13" rx="3" /><path d="M12 3v4M9 13h.01M15 13h.01M9 17h6" /><path d="M8 7V5m8 2V5" /></>,
  target: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><path d="m12 12 7-7m-4 0h4v4" /></>,
  automation: <><circle cx="12" cy="5" r="2" /><circle cx="5" cy="19" r="2" /><circle cx="19" cy="19" r="2" /><path d="M12 7v5m0 0H5v5m7-5h7v5" /></>,
  shield: <><path d="M12 3 20 6v5c0 5-3.4 8.2-8 10-4.6-1.8-8-5-8-10V6z" /><path d="m9 12 2 2 4-4" /></>,
  check: <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></>,
  play: <><path d="m8 5 11 7-11 7z" /></>,
  wallet: <><rect x="3" y="5" width="18" height="15" rx="3" /><path d="M3 9h18m-5 5h.01" /></>,
  ledger: <><path d="M6 3h12v18H6zM9 8h6M9 12h6M9 16h4" /><path d="M3 6v15h13" /></>,
  chart: <><path d="M4 19V5m0 14h17" /><path d="m7 15 4-4 3 2 5-6" /></>,
  audit: <><path d="M5 3h10l4 4v14H5zM14 3v5h5" /><path d="M8 12h8m-8 4h8" /></>,
  card: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18m-14 5h4" /></>,
  lock: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3" /></>,
  commerce: <><path d="M4 7h15l-2 10H7L5 4H2" /><circle cx="9" cy="20" r="1" /><circle cx="16" cy="20" r="1" /><path d="M8 11h7" /></>,
  key: <><circle cx="8" cy="15" r="4" /><path d="m11 12 9-9m-4 4 3 3m-6-1 3 3" /></>,
  users: <><circle cx="9" cy="8" r="3" /><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 4v2" /></>,
}

type NavigationItem = { id: PageId; label: string; icon: IconName; planned?: boolean }
type NavigationGroup = { label: string; items: NavigationItem[] }

const navigation: NavigationGroup[] = [
  { label: 'Visão geral', items: [{ id: 'overview', label: 'Visão geral', icon: 'home' }] },
  { label: 'Agentes', items: [
    { id: 'agents', label: 'Agentes', icon: 'agent' },
    { id: 'objectives', label: 'Objetivos', icon: 'target' },
    { id: 'automation', label: 'Automações', icon: 'automation' },
  ] },
  { label: 'Governança', items: [
    { id: 'policies', label: 'Policies', icon: 'shield' },
    { id: 'approvals', label: 'Aprovações', icon: 'check' },
    { id: 'shadow', label: 'Shadow Mode', icon: 'play' },
  ] },
  { label: 'Financeiro', items: [
    { id: 'wallet', label: 'Budgets lógicos', icon: 'wallet' },
    { id: 'ledger', label: 'Ledger', icon: 'ledger' },
    { id: 'outcomes', label: 'Resultados', icon: 'chart' },
    { id: 'commerce', label: 'Agent commerce', icon: 'commerce', planned: true },
  ] },
  { label: 'Segurança', items: [
    { id: 'audit', label: 'Auditoria', icon: 'audit' },
    { id: 'access', label: 'Equipe e permissões', icon: 'users' },
    { id: 'credentials', label: 'Credenciais de API', icon: 'key' },
    { id: 'cards', label: 'Cartões e pagamentos', icon: 'card', planned: true },
    { id: 'vault', label: 'Cofre de acessos', icon: 'lock', planned: true },
  ] },
]

export function Icon({ name }: { name: IconName }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{iconShapes[name]}</svg>
}

type HeaderProps = {
  activePage: PageId
  onNavigate: (page: PageId) => void
  onLogout: () => void
  email: string
  canAdmin: boolean
  apiOnline: boolean
  loading: boolean
  onRefresh: () => void
}

export default function HeaderNavigation({ activePage, onNavigate, onLogout, email, canAdmin, apiOnline, loading, onRefresh }: HeaderProps) {
  const [accountOpen, setAccountOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', focusSearch)
    return () => window.removeEventListener('keydown', focusSearch)
  }, [])
  const activeGroup = navigation.find(group => group.items.some(item => item.id === activePage)) ?? navigation[0]
  const items = activeGroup.items.filter(item => item.id !== 'credentials' || canAdmin)
  const searchResults = searchQuery.trim()
    ? navigation.flatMap(group => group.items).filter(item => (item.id !== 'credentials' || canAdmin) && item.label.toLocaleLowerCase('pt-BR').includes(searchQuery.trim().toLocaleLowerCase('pt-BR'))).slice(0, 6)
    : []
  const navigateTo = (page: PageId) => {
    setSearchQuery('')
    onNavigate(page)
  }

  return <>
    <aside className="voytek-icon-sidebar">
      <button className="voytek-icon-brand" aria-label="Ir para visão geral" onClick={() => navigateTo('overview')} type="button"><img src="/brand/voytek-mark.png" alt="Voytek" /></button>
      <nav aria-label="Áreas do painel">
        {navigation.map(group => <button
          aria-current={activeGroup === group ? 'page' : undefined}
          className={'voytek-icon-nav-item' + (activeGroup === group ? ' is-active' : '')}
          key={group.label}
          onClick={() => navigateTo(group.items[0].id)}
          title={group.label}
          aria-label={group.label}
          type="button"
        ><Icon name={group.items[0].icon} /></button>)}
      </nav>
      <button className="voytek-icon-logout" aria-label="Sair da conta" title="Sair da conta" onClick={onLogout} type="button"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4m7-4 4-4-4-4m4 4H9" /></svg></button>
    </aside>
    <header className="voytek-header">
    <div className="voytek-header-main">
      <div className="voytek-header-title"><strong>VOYTEK</strong><span>Agentes sob controle</span></div>
      <div className="voytek-global-search">
        <label><Icon name="search" /><span className="v-sr-only">Buscar tela</span><input aria-label="Buscar tela" ref={searchRef} onChange={event => setSearchQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') setSearchQuery('') }} placeholder="Buscar tela ou recurso..." type="search" value={searchQuery} /><kbd>Ctrl K</kbd></label>
        {searchQuery && <div className="voytek-search-results" role="listbox" aria-label="Resultados da busca">
          {searchResults.length ? searchResults.map(item => <button key={item.id} onClick={() => navigateTo(item.id)} type="button"><Icon name={item.icon} />{item.label}</button>) : <span>Nenhuma tela encontrada.</span>}
        </div>}
      </div>
      <div className="voytek-header-actions">
        <span className={'voytek-api-status' + (apiOnline ? ' is-online' : ' is-offline')} title={apiOnline ? 'API conectada' : 'API indisponível'}><i aria-hidden="true" /><span>{apiOnline ? 'API conectada' : 'API indisponível'}</span></span>
        <button className="voytek-icon-action" disabled={loading} onClick={onRefresh} title="Atualizar dados" aria-label={loading ? 'Atualizando dados' : 'Atualizar dados'} type="button"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.8 9A7 7 0 0 1 18.7 7L20 12M4 12l1.3 5A7 7 0 0 0 18.2 15" /></svg></button>
        <div className="voytek-account-menu">
          <button className="voytek-user-button" aria-expanded={accountOpen} aria-label="Menu da conta" onClick={() => setAccountOpen(open => !open)} type="button">{email ? email.slice(0, 1).toUpperCase() : 'V'}</button>
          {accountOpen && <div className="voytek-account-popover"><strong>{email || 'Conta Voytek'}</strong><button onClick={() => { setAccountOpen(false); onLogout() }} type="button">Sair da conta</button></div>}
        </div>
      </div>
    </div>
    {items.length > 1 && <nav className="voytek-subnav" aria-label={'Telas de ' + activeGroup.label}>
      {items.map(item => <button aria-current={activePage === item.id ? 'page' : undefined} className={'voytek-subnav-item' + (activePage === item.id ? ' is-active' : '')} key={item.id} onClick={() => navigateTo(item.id)} type="button"><Icon name={item.icon} />{item.label}{item.planned && <small>Planejado</small>}</button>)}
    </nav>}
  </header>
  </>
}
