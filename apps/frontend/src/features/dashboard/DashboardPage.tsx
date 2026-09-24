import { useState } from 'react'
import { voytekApi, type Agent, type Budget, type LedgerEntry } from '../../api'
import { Icon } from '../../app/navigation'
import type { PageId } from '../../app/navigation'
import type { SharedPageProps } from '../../app/types'
import { Modal, Notice, Status } from '../../components/UI'
import AgentForm, { type AgentDraft } from '../agents/AgentForm'

type AgentFilter = 'all' | 'active' | 'draft' | 'inactive'
type Period = '7' | '30' | 'all'
type MobileView = 'budget' | 'states' | 'agents' | 'shadow' | 'activity'
type Props = SharedPageProps & {
  onNavigate: (page: PageId) => void
  onOpenAgent: (agentId: string) => void
}

function stateOf(agent: Agent): Exclude<AgentFilter, 'all'> {
  if (agent.killSwitchActivatedAtUtc) return 'inactive'
  const status = agent.status.toLowerCase()
  return status === 'active' ? 'active' : status === 'draft' ? 'draft' : 'inactive'
}

function formatMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(value)
  } catch {
    return value.toFixed(2) + ' ' + currency
  }
}

function budgetTotals(budgets: Budget[]) {
  const totals = new Map<string, { total: number; reserved: number; spent: number; available: number }>()
  for (const budget of budgets) {
    if (budget.status.toLowerCase() !== 'active') continue
    const item = totals.get(budget.currency) ?? { total: 0, reserved: 0, spent: 0, available: 0 }
    item.total += budget.totalAmount
    item.reserved += budget.reservedAmount
    item.spent += budget.spentAmount
    item.available += budget.availableAmount
    totals.set(budget.currency, item)
  }
  return [...totals]
}

function decisionKey(value: string | number) {
  if (typeof value === 'number') return ['allow', 'deny', 'humanapproval'][value] ?? 'unknown'
  return value.toLowerCase().replace(/[_\s-]/g, '')
}

function ledgerLabel(value: string | number) {
  if (typeof value === 'number') {
    return ['Budget alocado', 'Reserva criada', 'Reserva liberada', 'Despesa autorizada', 'Despesa negada', 'Despesa executada', 'Ajuste'][value] ?? 'Movimento'
  }
  const labels: Record<string, string> = {
    budgetallocated: 'Budget alocado',
    budgetreserved: 'Reserva criada',
    budgetreleased: 'Reserva liberada',
    expenseauthorized: 'Despesa autorizada',
    expensedenied: 'Despesa negada',
    expenseexecuted: 'Despesa executada',
    adjustment: 'Ajuste',
  }
  return labels[value.toLowerCase().replace(/[_\s-]/g, '')] ?? value.replace(/_/g, ' ')
}

function recent(value: string, period: Period) {
  if (period === 'all') return true
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) && timestamp >= Date.now() - Number(period) * 24 * 60 * 60 * 1000
}

export default function DashboardPage({ data, errors, loading, canManage, onRefresh, notify, onNavigate, onOpenAgent }: Props) {
  const [query, setQuery] = useState('')
  const [agentFilter, setAgentFilter] = useState<AgentFilter>('all')
  const [period, setPeriod] = useState<Period>('30')
  const [mobileView, setMobileView] = useState<MobileView>('budget')
  const [createOpen, setCreateOpen] = useState(false)
  const currencies = budgetTotals(data.budgets)
  const primary = currencies.length === 1 ? currencies[0] : null
  const money = (field: 'total' | 'reserved' | 'spent' | 'available') =>
    errors.budgets ? '—' : primary ? formatMoney(primary[1][field], primary[0]) : currencies.length === 0 ? formatMoney(0, 'BRL') : currencies.map(([currency, amounts]) => formatMoney(amounts[field], currency)).join(' · ')
  const counts = {
    active: data.agents.filter(agent => stateOf(agent) === 'active').length,
    draft: data.agents.filter(agent => stateOf(agent) === 'draft').length,
    inactive: data.agents.filter(agent => stateOf(agent) === 'inactive').length,
  }
  const approvals = data.approvals.filter(item => String(item.status).toLowerCase() === 'pending' || item.status === 0).length
  const periodActions = data.shadowActions.filter(item => recent(item.createdAtUtc, period))
  const decisions = {
    allow: periodActions.filter(item => decisionKey(item.decision) === 'allow').length,
    humanapproval: periodActions.filter(item => decisionKey(item.decision) === 'humanapproval').length,
    deny: periodActions.filter(item => decisionKey(item.decision) === 'deny').length,
  }
  const periodLedger = [...data.ledger].filter(item => recent(item.createdAtUtc, period)).sort((a, b) => b.createdAtUtc.localeCompare(a.createdAtUtc))
  const search = query.trim().toLocaleLowerCase('pt-BR')
  const agents = data.agents
    .filter(agent => agentFilter === 'all' || stateOf(agent) === agentFilter)
    .filter(agent => !search || [agent.name, agent.description, agent.specialization].join(' ').toLocaleLowerCase('pt-BR').includes(search))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

  async function createAgent(draft: AgentDraft) {
    await voytekApi.createAgent(draft)
    await onRefresh()
    setCreateOpen(false)
    notify('Agente criado em rascunho. Revise objetivo, budget e permissões antes de ativá-lo.')
  }

  return <div className="v-dashboard" data-mobile-view={mobileView}>
    <div className="v-dashboard-heading">
      <div><span>Bem-vindo(a),</span><h1>Visão geral</h1></div>
      <div className="v-dashboard-heading-actions">
        <button className="v-dashboard-approval-pill" onClick={() => onNavigate('approvals')} type="button"><Icon name="check" /> Aprovações pendentes <strong>{errors.approvals ? '—' : approvals}</strong></button>
        <label className="v-dashboard-period"><span>Período da atividade</span><select value={period} onChange={event => setPeriod(event.target.value as Period)}><option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option><option value="all">Todo o histórico</option></select></label>
      </div>
    </div>

    <nav className="v-dashboard-mobile-tabs" aria-label="Painéis da visão geral">
      {([
        ['budget', 'Budget'], ['states', 'Estados'], ['agents', 'Agentes'], ['shadow', 'Shadow'], ['activity', 'Ledger'],
      ] as const).map(([view, label]) => <button aria-current={mobileView === view ? 'page' : undefined} className={mobileView === view ? 'is-active' : ''} key={view} onClick={() => setMobileView(view)} type="button">{label}</button>)}
    </nav>

    <div className="v-dashboard-top">
      <section className="v-dashboard-card v-budget-card" aria-labelledby="v-budget-title">
        <header><span className="v-dashboard-card-icon"><Icon name="wallet" /></span><h2 id="v-budget-title">Budget lógico disponível</h2><button onClick={() => onNavigate('wallet')} type="button" aria-label="Abrir budgets">→</button></header>
        <strong className="v-budget-amount">{loading && !data.budgets.length ? 'Carregando…' : currencies.length > 1 ? currencies.length + ' moedas' : money('available')}</strong>
        {errors.budgets ? <Notice tone="error">{errors.budgets}</Notice> : currencies.length > 1 && <p className="v-budget-currencies">{currencies.map(([currency, amounts]) => formatMoney(amounts.available, currency)).join(' · ')}</p>}
        <div className="v-budget-breakdown">
          <div><small>Total</small><strong>{money('total')}</strong></div>
          <div><small>Reservado</small><strong>{money('reserved')}</strong></div>
          <div><small>Gasto</small><strong>{money('spent')}</strong></div>
          <div><small>Disponível</small><strong>{money('available')}</strong></div>
        </div>
        <p className="v-budget-footnote">Controle lógico de autorizações; sem dinheiro custodiado.</p>
      </section>

      <section className="v-dashboard-card v-agent-states-card" aria-labelledby="v-agent-states-title">
        <header><span className="v-dashboard-card-icon"><Icon name="agent" /></span><h2 id="v-agent-states-title">Agentes por estado</h2><button onClick={() => onNavigate('agents')} type="button" aria-label="Abrir agentes">→</button></header>
        {errors.agents ? <Notice tone="error">{errors.agents}</Notice> : <div className="v-agent-state-grid">
          <button onClick={() => { setAgentFilter('active'); setMobileView('agents') }} type="button"><strong>{counts.active}</strong><span>Ativos</span><i className="is-active" /></button>
          <button onClick={() => { setAgentFilter('draft'); setMobileView('agents') }} type="button"><strong>{counts.draft}</strong><span>Rascunhos</span><i className="is-draft" /></button>
          <button onClick={() => { setAgentFilter('inactive'); setMobileView('agents') }} type="button"><strong>{counts.inactive}</strong><span>Pausados</span><i className="is-inactive" /></button>
        </div>}
        <p className="v-agent-states-footnote">{errors.agents ? 'Dados indisponíveis' : data.agents.length + (data.agents.length === 1 ? ' agente cadastrado na organização' : ' agentes cadastrados na organização')}</p>
      </section>

      <aside className="v-dashboard-card v-dashboard-agents" aria-labelledby="v-dashboard-agents-title">
        <header><span className="v-dashboard-card-icon"><Icon name="agent" /></span><h2 id="v-dashboard-agents-title">Agentes</h2><span className="v-card-count">{errors.agents ? '—' : data.agents.length}</span></header>
        <label className="v-dashboard-agent-search"><Icon name="search" /><span className="v-sr-only">Buscar agentes</span><input onChange={event => setQuery(event.target.value)} placeholder="Buscar agentes..." type="search" value={query} /></label>
        <div className="v-dashboard-filters" role="group" aria-label="Filtrar agentes">
          {([
            ['all', 'Todos'], ['active', 'Ativos'], ['draft', 'Rascunhos'], ['inactive', 'Pausados'],
          ] as const).map(([key, label]) => <button aria-pressed={agentFilter === key} className={agentFilter === key ? 'is-active' : ''} key={key} onClick={() => setAgentFilter(key)} type="button">{label}</button>)}
        </div>
        {canManage && <button className="v-dashboard-create" onClick={() => setCreateOpen(true)} type="button">+ Criar agente</button>}
        {errors.agents ? <Notice tone="error">{errors.agents}</Notice> : agents.length === 0 ? <div className="v-dashboard-agent-empty"><Icon name="agent" /><strong>{loading ? 'Carregando agentes…' : query || agentFilter !== 'all' ? 'Nenhum agente encontrado' : 'Nenhum agente ainda'}</strong><p>{query || agentFilter !== 'all' ? 'Ajuste a busca ou o filtro.' : 'Crie seu primeiro agente para começar.'}</p></div> : <div className="v-dashboard-agent-list">{agents.map(agent => <button className="v-dashboard-agent-row" key={agent.id} onClick={() => onOpenAgent(agent.id)} type="button"><span className="v-dashboard-agent-avatar"><Icon name="agent" /></span><span><strong>{agent.name}</strong><small>{agent.description || 'Sem descrição'}</small></span><Status value={agent.killSwitchActivatedAtUtc ? 'Suspended' : agent.status} /></button>)}</div>}
        <button className="v-dashboard-all-agents" onClick={() => onNavigate('agents')} type="button">Gerenciar agentes <span aria-hidden="true">→</span></button>
      </aside>
    </div>

    <div className="v-dashboard-bottom">
      <section className="v-dashboard-card v-shadow-card" aria-labelledby="v-shadow-title">
        <header><span className="v-dashboard-card-icon"><Icon name="shield" /></span><h2 id="v-shadow-title">Decisões em Shadow Mode</h2><button onClick={() => onNavigate('shadow')} type="button" aria-label="Abrir Shadow Mode">→</button></header>
        {errors.shadowActions ? <Notice tone="error">{errors.shadowActions}</Notice> : <div className="v-shadow-stats">
          <div><strong>{decisions.allow}</strong><span>Permitidas</span><i /></div>
          <div><strong>{decisions.humanapproval}</strong><span>Em revisão</span><i /></div>
          <div><strong>{decisions.deny}</strong><span>Negadas</span><i /></div>
        </div>}
        <p className="v-dashboard-info">Simulações avaliadas pelo policy engine. Nenhuma ação externa é executada em Shadow Mode.</p>
      </section>
      <section className="v-dashboard-card v-activity-card" aria-labelledby="v-activity-title">
        <header><span className="v-dashboard-card-icon"><Icon name="ledger" /></span><h2 id="v-activity-title">Atividade recente</h2><button className="v-activity-all" onClick={() => onNavigate('ledger')} type="button">Ver ledger →</button></header>
        {errors.ledger ? <Notice tone="error">{errors.ledger}</Notice> : periodLedger.length === 0 ? <div className="v-dashboard-activity-empty"><Icon name="ledger" /><strong>{loading ? 'Carregando atividade…' : 'Nenhuma atividade recente'}</strong><p>Os lançamentos do ledger aparecerão aqui.</p></div> : <div className="v-dashboard-activity-list">{periodLedger.slice(0, 4).map((entry: LedgerEntry) => <div className="v-dashboard-activity-row" key={entry.id}>
          <span className="v-activity-icon"><Icon name="ledger" /></span>
          <span><strong>{ledgerLabel(entry.type)}</strong><small>{data.agents.find(agent => agent.id === entry.agentId)?.name ?? 'Agente ' + entry.agentId.slice(0, 8)}</small></span>
          <time dateTime={entry.createdAtUtc}>{new Date(entry.createdAtUtc).toLocaleDateString('pt-BR')}</time>
          <strong>{formatMoney(entry.amount, entry.currency)}</strong>
        </div>)}</div>}
      </section>
    </div>
    {createOpen && canManage && <Modal title="Criar agente" description="O agente começa em rascunho. Revise objetivo, budget e permissões antes de ativá-lo." onClose={() => setCreateOpen(false)}><AgentForm onSubmit={createAgent} onCancel={() => setCreateOpen(false)} /></Modal>}
  </div>
}
