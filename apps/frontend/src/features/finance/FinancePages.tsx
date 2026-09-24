import { useMemo, useState, type FormEvent } from 'react'
import { voytekApi, type Budget, type LedgerEntry, type Outcome } from '../../api'
import { EmptyState, Field, Modal, Notice, PageHeading, Panel, Status } from '../../components/UI'
import type { SharedPageProps } from '../../app/types'

type Section = 'wallet' | 'ledger' | 'outcomes' | 'audit'
type Props = SharedPageProps & { section: Section }

export default function FinancePages(props: Props) {
  if (props.section === 'wallet') return <WalletPage {...props} />
  if (props.section === 'ledger') return <LedgerPage {...props} />
  if (props.section === 'outcomes') return <OutcomesPage {...props} />
  return <AuditPage {...props} />
}

function money(amount: number, currency = 'BRL') {
  try {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(amount)
  } catch {
    return amount.toFixed(2) + ' ' + currency
  }
}

function totalsByCurrency(items: Budget[], amount: (budget: Budget) => number) {
  if (items.length === 0) return 'Sem budgets'
  const totals = new Map<string, number>()
  for (const item of items) totals.set(item.currency, (totals.get(item.currency) ?? 0) + amount(item))
  return Array.from(totals, ([currency, value]) => money(value, currency)).join(' · ')
}

function WalletPage({ data, errors, loading, canManage, onRefresh, notify }: SharedPageProps) {
  const [formOpen, setFormOpen] = useState(false)
  const [working, setWorking] = useState('')

  async function createBudget(payload: { agentId: string; objectiveId: string | null; name: string; totalAmount: number; currency: string }) {
    await voytekApi.createBudget(payload)
    await onRefresh()
    setFormOpen(false)
    notify('Budget lógico criado. Nenhum dinheiro foi depositado ou movimentado.')
  }

  async function closeBudget(budget: Budget) {
    if (!window.confirm('Fechar este budget? Novas reservas deixarão de ser permitidas.')) return
    setWorking(budget.id)
    try {
      await voytekApi.closeBudget(budget.id)
      await onRefresh()
      notify('Budget fechado.')
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : 'Não foi possível fechar o budget.', 'error')
    } finally {
      setWorking('')
    }
  }

  return <div className="v-page">
    <PageHeading title="Carteiras lógicas" description="Budgets por agente e objetivo. Estes valores não representam dinheiro custodiado pela Voytek." action={canManage && <button className="v-primary-button" onClick={() => setFormOpen(true)} type="button">Criar budget</button>} />
    <Notice tone="warning">Saldo lógico para controle de autorização; não é uma conta bancária, carteira de custódia nem cartão.</Notice>
    {errors.budgets && <Notice tone="error">{errors.budgets}</Notice>}
    <div className="v-metric-row v-metric-row-compact">
      <Metric label="Total lógico" value={errors.budgets ? '—' : totalsByCurrency(data.budgets, budget => budget.totalAmount)} detail="Agrupado por moeda" />
      <Metric label="Disponível" value={errors.budgets ? '—' : totalsByCurrency(data.budgets, budget => budget.availableAmount)} detail="Total menos reservas e gastos" />
      <Metric label="Reservado" value={errors.budgets ? '—' : totalsByCurrency(data.budgets, budget => budget.reservedAmount)} detail="Ações aguardando execução ou decisão" />
      <Metric label="Gasto registrado" value={errors.budgets ? '—' : totalsByCurrency(data.budgets, budget => budget.spentAmount)} detail="Conforme lançamentos do sistema" />
    </div>
    <Panel title="Budgets por agente" description="Valores e estados informados pelo ledger/budget service.">
      {loading && data.budgets.length === 0 ? <div className="v-loading-line">Carregando budgets…</div> : errors.budgets ? <EmptyState title="Budgets indisponíveis" description="A API não retornou os valores; os indicadores ficam ocultos para evitar mostrar zeros incorretos." /> : data.budgets.length === 0 ? <EmptyState title="Nenhum budget configurado" description={canManage ? 'Crie um budget lógico e associe-o a um agente e, se desejar, a um objetivo.' : 'Peça a um Owner, Admin ou Manager para configurar um budget.'} action={canManage && <button className="v-primary-button" onClick={() => setFormOpen(true)} type="button">Criar budget</button>} /> : (
        <div className="v-budget-list">{data.budgets.map(budget => {
          const agent = data.agents.find(item => item.id === budget.agentId)
          const objective = data.objectives.find(item => item.id === budget.objectiveId)
          const ratio = budget.totalAmount > 0 ? Math.min(100, ((budget.reservedAmount + budget.spentAmount) / budget.totalAmount) * 100) : 0
          return <article className="v-budget-row" key={budget.id}>
            <div className="v-budget-title"><div><strong>{budget.name}</strong><small>{agent?.name ?? budget.agentId.slice(0, 8)}{objective ? ' · ' + objective.name : ''}</small></div><Status value={budget.status} /></div>
            <div className="v-budget-bar" role="img" aria-label={ratio.toFixed(0) + '% do budget reservado ou gasto'}><span style={{ width: ratio + '%' }} /></div>
            <div className="v-budget-values"><span>Total <strong>{money(budget.totalAmount, budget.currency)}</strong></span><span>Disponível <strong>{money(budget.availableAmount, budget.currency)}</strong></span><span>Reservado <strong>{money(budget.reservedAmount, budget.currency)}</strong></span><span>Gasto <strong>{money(budget.spentAmount, budget.currency)}</strong></span></div>
            {canManage && String(budget.status).toLowerCase() === 'active' && <button className="v-row-action-danger" disabled={working === budget.id} onClick={() => void closeBudget(budget)} type="button">Fechar budget</button>}
          </article>
        })}</div>
      )}
    </Panel>
    {formOpen && <Modal title="Novo budget lógico" description="Budgets limitam autorizações; não adicionam saldo bancário." onClose={() => setFormOpen(false)}>
      <BudgetForm agents={data.agents} objectives={data.objectives} onSubmit={createBudget} onCancel={() => setFormOpen(false)} />
    </Modal>}
  </div>
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <article className="v-metric"><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>
}

function BudgetForm({ agents, objectives, onSubmit, onCancel }: {
  agents: { id: string; name: string }[]
  objectives: { id: string; agentId: string; name: string }[]
  onSubmit: (payload: { agentId: string; objectiveId: string | null; name: string; totalAmount: number; currency: string }) => Promise<void>
  onCancel: () => void
}) {
  const [agentId, setAgentId] = useState(agents[0]?.id ?? '')
  const [objectiveId, setObjectiveId] = useState('')
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('BRL')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const availableObjectives = objectives.filter(item => item.agentId === agentId)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const totalAmount = Number(amount)
    if (!agentId) return setError('Crie ou selecione um agente.')
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) return setError('Informe um valor maior que zero.')
    setError('')
    setBusy(true)
    try {
      await onSubmit({ agentId, objectiveId: objectiveId || null, name: name.trim(), totalAmount, currency: currency.trim().toUpperCase() })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível criar o budget.')
    } finally {
      setBusy(false)
    }
  }

  return <form className="v-form-stack" onSubmit={submit}>
    <Field label="Agente"><select required value={agentId} onChange={event => { setAgentId(event.target.value); setObjectiveId('') }}><option value="">Selecione</option>{agents.map(agent => <option value={agent.id} key={agent.id}>{agent.name}</option>)}</select></Field>
    <Field label="Objetivo (opcional)"><select value={objectiveId} onChange={event => setObjectiveId(event.target.value)}><option value="">Sem objetivo associado</option>{availableObjectives.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></Field>
    <Field label="Nome do budget"><input maxLength={150} required value={name} onChange={event => setName(event.target.value)} placeholder="Ex.: Cloud mensal" /></Field>
    <div className="v-form-grid">
      <Field label="Valor total"><input min="0.01" required step="0.01" type="number" value={amount} onChange={event => setAmount(event.target.value)} /></Field>
      <Field label="Moeda"><select value={currency} onChange={event => setCurrency(event.target.value)}><option value="BRL">BRL · Real</option><option value="USD">USD · Dólar</option><option value="EUR">EUR · Euro</option></select></Field>
    </div>
    {error && <p className="v-form-error" role="alert">{error}</p>}
    <div className="v-form-actions"><button className="v-secondary-button" onClick={onCancel} type="button">Cancelar</button><button className="v-primary-button" disabled={busy || agents.length === 0} type="submit">{busy ? 'Salvando…' : 'Criar budget'}</button></div>
  </form>
}

function LedgerPage({ data, errors, loading }: SharedPageProps) {
  const [query, setQuery] = useState('')
  const rows = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return [...data.ledger]
      .sort((a, b) => b.createdAtUtc.localeCompare(a.createdAtUtc))
      .filter(item => !normalized || [item.type, item.agentId, item.objectiveId, item.budgetId, item.correlationId].join(' ').toLowerCase().includes(normalized))
  }, [data.ledger, query])

  return <div className="v-page">
    <PageHeading title="Ledger" description="Registro econômico append-only: reservas, decisões e movimentos reconhecidos pelo sistema." />
    <div className="v-filter-row"><label>Filtrar <input aria-label="Filtrar ledger" onChange={event => setQuery(event.target.value)} placeholder="Tipo, agente, referência…" value={query} /></label><span>{errors.ledger ? 'Dados indisponíveis' : rows.length + ' lançamento(s)'}</span></div>
    {errors.ledger && <Notice tone="error">{errors.ledger}</Notice>}
    <Panel title="Histórico econômico" description="Cada lançamento permanece associado a agente, objetivo, budget e autorização.">
      {loading && data.ledger.length === 0 ? <div className="v-loading-line">Carregando ledger…</div> : errors.ledger ? <EmptyState title="Ledger indisponível" description="Não foi possível consultar os registros." /> : rows.length === 0 ? <EmptyState title="Sem lançamentos" description="Quando uma ação gerar reserva ou decisão econômica, o registro aparecerá aqui." /> : (
        <div className="v-table-wrap"><table className="v-table">
          <thead><tr><th>Tipo</th><th>Agente</th><th>Valor</th><th>Budget</th><th>Correlação</th><th>Data</th></tr></thead>
          <tbody>{rows.map((item: LedgerEntry) => <tr key={item.id}>
            <td>{ledgerType(item.type)}</td><td><code>{item.agentId.slice(0, 8)}</code></td><td>{money(item.amount, item.currency)}</td><td><code>{item.budgetId.slice(0, 8)}</code></td><td><code>{item.correlationId.slice(0, 12)}</code></td><td>{new Date(item.createdAtUtc).toLocaleString('pt-BR')}</td>
          </tr>)}</tbody>
        </table></div>
      )}
    </Panel>
  </div>
}

function ledgerType(value: string | number) {
  const numeric: Record<number, string> = { 0: 'Budget alocado', 1: 'Reserva criada', 2: 'Reserva liberada', 3: 'Despesa autorizada', 4: 'Despesa negada', 5: 'Despesa executada', 6: 'Ajuste' }
  return typeof value === 'number' ? numeric[value] ?? String(value) : value.split('_').join(' ')
}

function OutcomesPage({ data, errors, loading, canManage, onRefresh, notify }: SharedPageProps) {
  const [formOpen, setFormOpen] = useState(false)
  async function create(payload: {
    agentId: string; objectiveId: string; authorizationId: string | null; metric: string; value: number; unit: string; description: string
  }) {
    await voytekApi.createOutcome(payload)
    await onRefresh()
    setFormOpen(false)
    notify('Resultado registrado.')
  }

  return <div className="v-page">
    <PageHeading title="Resultados" description="Registre outcomes associados a um agente, objetivo e, quando houver, à autorização correspondente." action={canManage && <button className="v-primary-button" onClick={() => setFormOpen(true)} type="button">Registrar resultado</button>} />
    {errors.outcomes && <Notice tone="error">{errors.outcomes}</Notice>}
    <Panel title="Outcome ledger" description="Métricas são registros informados pela operação; a Voytek não presume impacto sem dados.">
      {loading && data.outcomes.length === 0 ? <div className="v-loading-line">Carregando resultados…</div> : errors.outcomes ? <EmptyState title="Resultados indisponíveis" description="Não foi possível consultar os outcomes." /> : data.outcomes.length === 0 ? <EmptyState title="Nenhum resultado registrado" description={canManage ? 'Associe uma métrica ao objetivo para acompanhar o resultado de uma autorização.' : 'Peça a um Owner, Admin ou Manager para registrar resultados.'} action={canManage && <button className="v-primary-button" onClick={() => setFormOpen(true)} type="button">Registrar resultado</button>} /> : (
        <div className="v-table-wrap"><table className="v-table">
          <thead><tr><th>Métrica</th><th>Valor</th><th>Agente</th><th>Objetivo</th><th>Registrado</th></tr></thead>
          <tbody>{data.outcomes.map((item: Outcome) => <tr key={item.id}>
            <td><strong>{item.metric}</strong><small className="v-cell-detail">{item.description}</small></td><td>{item.value} {item.unit}</td><td>{data.agents.find(agent => agent.id === item.agentId)?.name ?? item.agentId.slice(0, 8)}</td><td>{data.objectives.find(objective => objective.id === item.objectiveId)?.name ?? item.objectiveId.slice(0, 8)}</td><td>{new Date(item.createdAtUtc).toLocaleDateString('pt-BR')}</td>
          </tr>)}</tbody>
        </table></div>
      )}
    </Panel>
    {formOpen && <Modal title="Registrar resultado" description="Informe um resultado já observado; este formulário não calcula economia automaticamente." onClose={() => setFormOpen(false)}>
      <OutcomeForm agents={data.agents} objectives={data.objectives} onSubmit={create} onCancel={() => setFormOpen(false)} />
    </Modal>}
  </div>
}

function OutcomeForm({ agents, objectives, onSubmit, onCancel }: {
  agents: { id: string; name: string }[]
  objectives: { id: string; agentId: string; name: string }[]
  onSubmit: (payload: { agentId: string; objectiveId: string; authorizationId: string | null; metric: string; value: number; unit: string; description: string }) => Promise<void>
  onCancel: () => void
}) {
  const [agentId, setAgentId] = useState(agents[0]?.id ?? '')
  const [objectiveId, setObjectiveId] = useState('')
  const [metric, setMetric] = useState('')
  const [value, setValue] = useState('')
  const [unit, setUnit] = useState('')
  const [authorizationId, setAuthorizationId] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const choices = objectives.filter(item => item.agentId === agentId)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const numeric = Number(value)
    if (!agentId || !objectiveId) return setError('Selecione agente e objetivo.')
    if (!Number.isFinite(numeric)) return setError('Informe um valor válido.')
    setBusy(true)
    setError('')
    try {
      await onSubmit({ agentId, objectiveId, authorizationId: authorizationId.trim() || null, metric: metric.trim(), value: numeric, unit: unit.trim(), description: description.trim() })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível registrar o resultado.')
    } finally {
      setBusy(false)
    }
  }

  return <form className="v-form-stack" onSubmit={submit}>
    <Field label="Agente"><select required value={agentId} onChange={event => { setAgentId(event.target.value); setObjectiveId('') }}><option value="">Selecione</option>{agents.map(agent => <option value={agent.id} key={agent.id}>{agent.name}</option>)}</select></Field>
    <Field label="Objetivo"><select required value={objectiveId} onChange={event => setObjectiveId(event.target.value)}><option value="">Selecione</option>{choices.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></Field>
    <div className="v-form-grid">
      <Field label="Métrica"><input maxLength={200} required value={metric} onChange={event => setMetric(event.target.value)} placeholder="Ex.: custo mensal" /></Field>
      <Field label="Valor"><input required step="any" type="number" value={value} onChange={event => setValue(event.target.value)} /></Field>
      <Field label="Unidade"><input maxLength={60} required value={unit} onChange={event => setUnit(event.target.value)} placeholder="BRL, %, licenças" /></Field>
      <Field label="ID de autorização (opcional)"><input value={authorizationId} onChange={event => setAuthorizationId(event.target.value)} /></Field>
    </div>
    <Field label="Descrição"><textarea maxLength={2000} rows={2} value={description} onChange={event => setDescription(event.target.value)} /></Field>
    {error && <p className="v-form-error" role="alert">{error}</p>}
    <div className="v-form-actions"><button className="v-secondary-button" onClick={onCancel} type="button">Cancelar</button><button className="v-primary-button" disabled={busy || choices.length === 0} type="submit">{busy ? 'Salvando…' : 'Registrar resultado'}</button></div>
  </form>
}

function AuditPage({ data, errors, loading }: SharedPageProps) {
  const [query, setQuery] = useState('')
  const rows = useMemo(() => {
    const filter = query.trim().toLowerCase()
    return [...data.audit].sort((a, b) => b.createdAtUtc.localeCompare(a.createdAtUtc)).filter(event =>
      !filter || [event.action, event.resourceType, event.resourceId, event.correlationId].join(' ').toLowerCase().includes(filter),
    )
  }, [data.audit, query])
  return <div className="v-page">
    <PageHeading title="Auditoria" description="Eventos administrativos e de segurança que ajudam a reconstruir decisões." />
    <div className="v-filter-row"><label>Filtrar <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Ação ou recurso…" /></label><span>{errors.audit ? 'Dados indisponíveis' : rows.length + ' evento(s)'}</span></div>
    {errors.audit && <Notice tone="error">{errors.audit}</Notice>}
    <Panel title="Eventos auditáveis" description="A API registra alterações administrativas e decisões relevantes.">
      {loading && data.audit.length === 0 ? <div className="v-loading-line">Carregando auditoria…</div> : errors.audit ? <EmptyState title="Auditoria indisponível" description="Não foi possível consultar os eventos." /> : rows.length === 0 ? <EmptyState title="Sem eventos registrados" description="Ações relevantes aparecerão após a API registrar eventos de auditoria." /> : (
        <div className="v-table-wrap"><table className="v-table">
          <thead><tr><th>Ação</th><th>Recurso</th><th>Ator</th><th>Correlação</th><th>Data</th></tr></thead>
          <tbody>{rows.map(event => <tr key={event.id}><td><strong>{event.action}</strong></td><td>{event.resourceType} · <code>{event.resourceId.slice(0, 8)}</code></td><td>{event.actorUserId ? event.actorUserId.slice(0, 8) : 'Sistema'}</td><td><code>{event.correlationId.slice(0, 12)}</code></td><td>{new Date(event.createdAtUtc).toLocaleString('pt-BR')}</td></tr>)}</tbody>
        </table></div>
      )}
    </Panel>
  </div>
}
