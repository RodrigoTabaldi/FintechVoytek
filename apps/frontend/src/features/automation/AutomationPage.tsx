import { useMemo, useState, type FormEvent } from 'react'
import { voytekApi, type AuthorizationResult } from '../../api'
import { EmptyState, Field, Modal, Notice, PageHeading, Panel, Status } from '../../components/UI'
import type { SharedPageProps } from '../../app/types'

type AutomationTab = 'actions' | 'saas'

export default function AutomationPage(props: SharedPageProps) {
  const [tab, setTab] = useState<AutomationTab>('actions')
  return <div className="v-page">
    <PageHeading title="Automações" description="Transforme instruções em propostas, depois passe ações pelo policy engine antes de qualquer execução." />
    <div className="v-segment-control" role="tablist" aria-label="Tipos de automação">
      <button aria-selected={tab === 'actions'} onClick={() => setTab('actions')} role="tab" type="button">Propostas e autorizações</button>
      <button aria-selected={tab === 'saas'} onClick={() => setTab('saas')} role="tab" type="button">Gestão de SaaS</button>
    </div>
    {tab === 'actions' ? <AgentAutomation {...props} /> : <SaasAutomation {...props} />}
  </div>
}

function AgentAutomation({ data, errors, canManage, onRefresh, notify }: SharedPageProps) {
  const [proposal, setProposal] = useState<Record<string, unknown> | null>(null)
  const [proposalError, setProposalError] = useState('')
  const [proposalBusy, setProposalBusy] = useState(false)
  const [authorization, setAuthorization] = useState<AuthorizationResult | null>(null)
  const activeAgents = data.agents.filter(agent => agent.status.toLowerCase() === 'active' && !agent.killSwitchActivatedAtUtc)

  async function requestProposal(agentId: string, instruction: string) {
    setProposalBusy(true)
    setProposalError('')
    setProposal(null)
    try {
      const result = await voytekApi.generateProposal(agentId, instruction)
      setProposal(result)
      notify('Proposta recebida. Ela ainda não autoriza nem executa uma ação.')
    } catch (cause) {
      setProposalError(cause instanceof Error ? cause.message : 'Não foi possível gerar a proposta.')
    } finally {
      setProposalBusy(false)
    }
  }

  async function requestAuthorization(payload: {
    agentId: string
    objectiveId: string
    budgetId: string
    actionType: string
    amount: number
    currency: string
    purpose: string
    idempotencyKey: string
    shadowMode: boolean
  }) {
    const result = await voytekApi.authorize(payload)
    setAuthorization(result)
    await onRefresh()
    notify('Avaliação registrada pelo policy engine. Nenhuma ação externa foi executada.', 'info')
  }

  return <div className="v-automation-grid">
    <Panel title="Pedir uma proposta ao agente" description="O modelo pode estruturar uma sugestão. A API continua sendo a autoridade de autorização.">
      {canManage ? <ProposalForm agents={activeAgents} onSubmit={requestProposal} /> : <Notice tone="info">Gerar propostas exige papel Owner, Admin ou Manager.</Notice>}
      {errors.agents && <Notice tone="error">{errors.agents}</Notice>}
      {proposalError && <Notice tone="error">{proposalError}</Notice>}
      {proposal && <div className="v-proposal-result"><div><strong>Proposta recebida</strong><span>Não executada</span></div><pre>{JSON.stringify(proposal, null, 2)}</pre></div>}
    </Panel>

    <Panel title="Avaliar ação em Shadow Mode" description="A simulação passa pelas regras, budgets e autonomia antes de registrar a decisão.">
      <Notice tone="warning">Esta tela envia somente <code>shadowMode: true</code>. Não existe opção de pagamento ou execução real.</Notice>
      <AuthorizationForm data={data} onSubmit={requestAuthorization} />
      {errors.agents && <Notice tone="error">Agentes: {errors.agents}</Notice>}
      {errors.objectives && <Notice tone="error">Objetivos: {errors.objectives}</Notice>}
      {errors.budgets && <Notice tone="error">Budgets: {errors.budgets}</Notice>}
      {authorization && <div className="v-decision-result">
        <span>Decisão do policy engine</span>
        <strong><Status value={authorization.decision} /></strong>
        <p>{authorization.decisionReason}</p>
        <small>Registro {authorization.id} · {new Date(authorization.decidedAtUtc).toLocaleString('pt-BR')}</small>
      </div>}
    </Panel>

    <Panel className="v-voice-foundation" title="Entrada por voz" description="Base de produto planejada para converter fala em instruções revisáveis.">
      <div className="v-voice-state"><span className="v-voice-icon" aria-hidden="true">◖</span><div><strong>Transcrição ainda não conectada</strong><p className="v-muted">O caminho seguro será voz → texto revisável → proposta → policy engine. Por enquanto, use instruções em texto.</p></div></div>
      <button className="v-secondary-button" disabled type="button">Gravar instrução · em breve</button>
    </Panel>
  </div>
}

function ProposalForm({ agents, onSubmit }: {
  agents: { id: string; name: string }[]
  onSubmit: (agentId: string, instruction: string) => Promise<void>
}) {
  const [agentId, setAgentId] = useState(agents[0]?.id ?? '')
  const [instruction, setInstruction] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const currentAgents = agents
  const effectiveAgentId = currentAgents.some(agent => agent.id === agentId) ? agentId : currentAgents[0]?.id ?? ''

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!effectiveAgentId) return setError('Ative um agente sem kill switch antes de pedir uma proposta.')
    if (!instruction.trim()) return setError('Escreva a instrução que o agente deve analisar.')
    if (instruction.length > 4000) return setError('A instrução deve ter até 4.000 caracteres.')
    setError('')
    setBusy(true)
    try {
      await onSubmit(effectiveAgentId, instruction.trim())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao enviar instrução.')
    } finally {
      setBusy(false)
    }
  }

  return <form className="v-form-stack" onSubmit={submit}>
    <Field label="Agente ativo"><select disabled={agents.length === 0} value={effectiveAgentId} onChange={event => setAgentId(event.target.value)}><option value="">Selecione um agente</option>{agents.map(agent => <option value={agent.id} key={agent.id}>{agent.name}</option>)}</select></Field>
    <Field label="Instrução" hint="Até 4.000 caracteres. A saída é uma proposta, não uma autorização."><textarea maxLength={4000} required rows={5} value={instruction} onChange={event => setInstruction(event.target.value)} placeholder="Ex.: analise as assinaturas sem usuários ativos e proponha uma revisão." /></Field>
    {agents.length === 0 && <p className="v-muted">Crie e ative um agente para habilitar propostas.</p>}
    {error && <p className="v-form-error" role="alert">{error}</p>}
    <button className="v-primary-button" disabled={busy || agents.length === 0} type="submit">{busy ? 'Analisando…' : 'Gerar proposta'}</button>
  </form>
}

function AuthorizationForm({ data, onSubmit }: {
  data: SharedPageProps['data']
  onSubmit: (payload: {
    agentId: string
    objectiveId: string
    budgetId: string
    actionType: string
    amount: number
    currency: string
    purpose: string
    idempotencyKey: string
    shadowMode: boolean
  }) => Promise<void>
}) {
  const activeAgents = data.agents.filter(agent => agent.status.toLowerCase() === 'active' && !agent.killSwitchActivatedAtUtc)
  const [agentId, setAgentId] = useState(activeAgents[0]?.id ?? '')
  const effectiveAgentId = activeAgents.some(item => item.id === agentId) ? agentId : activeAgents[0]?.id ?? ''
  const objectives = useMemo(() => data.objectives.filter(item => item.agentId === effectiveAgentId && item.status.toLowerCase() === 'active'), [data.objectives, effectiveAgentId])
  const [objectiveId, setObjectiveId] = useState('')
  const effectiveObjectiveId = objectives.some(item => item.id === objectiveId) ? objectiveId : objectives[0]?.id ?? ''
  const budgets = data.budgets.filter(item => item.agentId === effectiveAgentId && item.status.toLowerCase() === 'active' && (item.objectiveId == null || item.objectiveId === effectiveObjectiveId))
  const [budgetId, setBudgetId] = useState('')
  const effectiveBudgetId = budgets.some(item => item.id === budgetId) ? budgetId : budgets[0]?.id ?? ''
  const [actionType, setActionType] = useState('purchase')
  const [amount, setAmount] = useState('')
  const [purpose, setPurpose] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const budget = budgets.find(item => item.id === effectiveBudgetId)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const numericAmount = Number(amount)
    if (!effectiveAgentId || !effectiveObjectiveId || !effectiveBudgetId) return setError('Selecione um agente ativo, objetivo ativo e budget ativo compatíveis.')
    if (!Number.isFinite(numericAmount) || numericAmount <= 0 || Math.round(numericAmount * 100) !== numericAmount * 100) return setError('Informe um valor positivo com até duas casas decimais.')
    if (!purpose.trim()) return setError('Descreva por que esta ação atende ao objetivo selecionado.')
    setError('')
    setBusy(true)
    try {
      await onSubmit({
        agentId: effectiveAgentId,
        objectiveId: effectiveObjectiveId,
        budgetId: effectiveBudgetId,
        actionType: actionType.trim(),
        amount: numericAmount,
        currency: budget?.currency ?? 'BRL',
        purpose: purpose.trim(),
        idempotencyKey: crypto.randomUUID(),
        shadowMode: true,
      })
      setAmount('')
      setPurpose('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível avaliar a ação.')
    } finally {
      setBusy(false)
    }
  }

  return <form className="v-form-stack" onSubmit={submit}>
    <Field label="Agente"><select required value={effectiveAgentId} onChange={event => { setAgentId(event.target.value); setObjectiveId(''); setBudgetId('') }}><option value="">Selecione</option>{activeAgents.map(agent => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select></Field>
    <Field label="Objetivo"><select required value={effectiveObjectiveId} onChange={event => { setObjectiveId(event.target.value); setBudgetId('') }}><option value="">Selecione um objetivo ativo</option>{objectives.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></Field>
    <Field label="Budget"><select required value={effectiveBudgetId} onChange={event => setBudgetId(event.target.value)}><option value="">Selecione um budget ativo</option>{budgets.map(item => <option value={item.id} key={item.id}>{item.name} · {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: item.currency }).format(item.availableAmount)} disponível</option>)}</select></Field>
    <div className="v-form-grid">
      <Field label="Tipo da ação"><input maxLength={100} required value={actionType} onChange={event => setActionType(event.target.value)} placeholder="purchase" /></Field>
      <Field label="Valor"><input min="0.01" required step="0.01" type="number" value={amount} onChange={event => setAmount(event.target.value)} /></Field>
    </div>
    <Field label="Finalidade"><textarea maxLength={2000} required rows={3} value={purpose} onChange={event => setPurpose(event.target.value)} placeholder="Explique como a ação contribui para o objetivo." /></Field>
    {activeAgents.length === 0 && <p className="v-muted">Ative um agente para enviar a avaliação.</p>}
    {activeAgents.length > 0 && objectives.length === 0 && <p className="v-muted">Este agente ainda não tem objetivo ativo.</p>}
    {objectives.length > 0 && budgets.length === 0 && <p className="v-muted">Não há budget ativo compatível com este objetivo.</p>}
    {error && <p className="v-form-error" role="alert">{error}</p>}
    <button className="v-primary-button" disabled={busy || activeAgents.length === 0 || objectives.length === 0 || budgets.length === 0} type="submit">{busy ? 'Avaliando…' : 'Avaliar em Shadow Mode'}</button>
  </form>
}

function SaasAutomation({ data, errors, loading, canManage, saasAnalysisDone, saasRecommendations, onSaasAnalysisCompleted, onRefresh, notify }: SharedPageProps) {
  const [formOpen, setFormOpen] = useState(false)
  const [analysisBusy, setAnalysisBusy] = useState(false)

  async function createSubscription(payload: {
    agentId: string | null; provider: string; productName: string; monthlyCost: number; currency: string; purchasedSeats: number; activeUsers: number; renewalDate: string | null
  }) {
    await voytekApi.createSaasSubscription(payload)
    await onRefresh()
    setFormOpen(false)
    notify('Assinatura registrada para revisão; nenhuma compra ou cancelamento foi executado.')
  }

  async function analyze() {
    setAnalysisBusy(true)
    try {
      const result = await voytekApi.analyzeSaasSubscriptions()
      onSaasAnalysisCompleted(result)
      await onRefresh()
      notify('Análise concluída. As recomendações exigem revisão humana.', 'info')
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : 'Não foi possível analisar as assinaturas.', 'error')
    } finally {
      setAnalysisBusy(false)
    }
  }

  return <div className="v-page-section">
    <div className="v-section-heading"><div><h2>Assinaturas monitoradas</h2><p className="v-muted">A análise aponta renovações próximas e licenças sem usuários ativos; não cancela nem contrata serviços.</p></div>{canManage && <div className="v-form-actions"><button className="v-secondary-button" onClick={() => setFormOpen(true)} type="button">Registrar assinatura</button><button className="v-primary-button" disabled={analysisBusy || saasAnalysisDone || data.saasSubscriptions.length === 0} onClick={() => void analyze()} type="button">{analysisBusy ? 'Analisando…' : saasAnalysisDone ? 'Análise executada' : 'Analisar'}</button></div>}</div>
    {errors.saasSubscriptions && <Notice tone="error">{errors.saasSubscriptions}</Notice>}
    <Notice tone="warning">O endpoint atual grava novas recomendações a cada chamada e não oferece idempotência. O botão fica bloqueado após o primeiro retorno enquanto este workspace estiver aberto; recarregar ou entrar novamente permite outra execução.</Notice>
    <Panel title="Catálogo informado pela organização" description="Os dados são cadastrados manualmente enquanto conectores SaaS não existem.">
      {loading && data.saasSubscriptions.length === 0 ? <div className="v-loading-line">Carregando assinaturas…</div> : errors.saasSubscriptions ? <EmptyState title="Assinaturas indisponíveis" description="Não foi possível carregar os registros." /> : data.saasSubscriptions.length === 0 ? <EmptyState title="Nenhuma assinatura cadastrada" description={canManage ? 'Registre um serviço para permitir uma análise básica de renovação e utilização.' : 'Peça a um Owner, Admin ou Manager para cadastrar um serviço.'} action={canManage && <button className="v-secondary-button" onClick={() => setFormOpen(true)} type="button">Registrar assinatura</button>} /> : (
        <div className="v-table-wrap"><table className="v-table"><thead><tr><th>Produto</th><th>Fornecedor</th><th>Custo mensal</th><th>Assentos ativos</th><th>Renovação</th><th>Status</th></tr></thead>
          <tbody>{data.saasSubscriptions.map(item => <tr key={item.id}><td>{item.productName}</td><td>{item.provider}</td><td>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: item.currency }).format(item.monthlyCost)}</td><td>{item.activeUsers} / {item.purchasedSeats}</td><td>{item.renewalDate ?? 'Não informada'}</td><td><Status value={item.status} /></td></tr>)}</tbody>
        </table></div>
      )}
    </Panel>
    {saasRecommendations && <Panel title="Recomendações desta análise" description="Sugestões não são executadas automaticamente.">
      {saasRecommendations.length === 0 ? <EmptyState title="Nenhuma recomendação retornada" description="A API não encontrou assinatura sem uso ou renovação dentro da janela analisada." /> : <div className="v-recommendation-list">{saasRecommendations.map(item => <article key={item.id}><span className="v-status">{recommendationLabel(item.type)}</span><p>{item.reason}</p><small>Assinatura {item.subscriptionId.slice(0, 8)}</small></article>)}</div>}
    </Panel>}
    {formOpen && <Modal title="Registrar assinatura" description="O registro permite análise básica; não conecta ao fornecedor." onClose={() => setFormOpen(false)}>
      <SaasForm agents={data.agents} onSubmit={createSubscription} onCancel={() => setFormOpen(false)} />
    </Modal>}
  </div>
}

function recommendationLabel(value: string | number) {
  const labels: Record<number, string> = {
    0: 'Revisar assinatura sem uso',
    1: 'Revisar assinaturas duplicadas',
    2: 'Revisar renovação próxima',
  }
  if (typeof value === 'number') return labels[value] ?? 'Recomendação'
  const normalized = value.toLowerCase()
  if (normalized === 'reviewunusedsubscription') return labels[0]
  if (normalized === 'consolidateduplicatesubscription') return labels[1]
  if (normalized === 'reviewupcomingrenewal') return labels[2]
  return value
}

function SaasForm({ agents, onSubmit, onCancel }: {
  agents: { id: string; name: string }[]
  onSubmit: (payload: { agentId: string | null; provider: string; productName: string; monthlyCost: number; currency: string; purchasedSeats: number; activeUsers: number; renewalDate: string | null }) => Promise<void>
  onCancel: () => void
}) {
  const [agentId, setAgentId] = useState('')
  const [provider, setProvider] = useState('')
  const [productName, setProductName] = useState('')
  const [monthlyCost, setMonthlyCost] = useState('')
  const [currency, setCurrency] = useState('BRL')
  const [purchasedSeats, setPurchasedSeats] = useState('')
  const [activeUsers, setActiveUsers] = useState('')
  const [renewalDate, setRenewalDate] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const cost = Number(monthlyCost)
    const seats = Number(purchasedSeats)
    const users = Number(activeUsers)
    if (!Number.isFinite(cost) || cost < 0 || !Number.isInteger(seats) || seats < 0 || !Number.isInteger(users) || users < 0 || users > seats) return setError('Informe custo e assentos válidos; usuários ativos não podem superar os assentos contratados.')
    setError('')
    setBusy(true)
    try {
      await onSubmit({ agentId: agentId || null, provider: provider.trim(), productName: productName.trim(), monthlyCost: cost, currency, purchasedSeats: seats, activeUsers: users, renewalDate: renewalDate || null })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar a assinatura.')
    } finally {
      setBusy(false)
    }
  }

  return <form className="v-form-stack" onSubmit={submit}>
    <div className="v-form-grid"><Field label="Fornecedor"><input required maxLength={160} value={provider} onChange={event => setProvider(event.target.value)} /></Field><Field label="Produto"><input required maxLength={200} value={productName} onChange={event => setProductName(event.target.value)} /></Field></div>
    <Field label="Agente responsável (opcional)"><select value={agentId} onChange={event => setAgentId(event.target.value)}><option value="">Nenhum associado</option>{agents.map(agent => <option value={agent.id} key={agent.id}>{agent.name}</option>)}</select></Field>
    <div className="v-form-grid"><Field label="Custo mensal"><input min="0" required step="0.01" type="number" value={monthlyCost} onChange={event => setMonthlyCost(event.target.value)} /></Field><Field label="Moeda"><select value={currency} onChange={event => setCurrency(event.target.value)}><option>BRL</option><option>USD</option><option>EUR</option></select></Field></div>
    <div className="v-form-grid"><Field label="Assentos contratados"><input min="0" required step="1" type="number" value={purchasedSeats} onChange={event => setPurchasedSeats(event.target.value)} /></Field><Field label="Usuários ativos"><input min="0" required step="1" type="number" value={activeUsers} onChange={event => setActiveUsers(event.target.value)} /></Field></div>
    <Field label="Próxima renovação (opcional)"><input type="date" value={renewalDate} onChange={event => setRenewalDate(event.target.value)} /></Field>
    {error && <p className="v-form-error" role="alert">{error}</p>}
    <div className="v-form-actions"><button className="v-secondary-button" onClick={onCancel} type="button">Cancelar</button><button className="v-primary-button" disabled={busy} type="submit">{busy ? 'Salvando…' : 'Registrar serviço'}</button></div>
  </form>
}
