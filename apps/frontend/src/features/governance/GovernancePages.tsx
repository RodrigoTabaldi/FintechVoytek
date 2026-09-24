import { useState, type FormEvent } from 'react'
import { voytekApi, type Objective } from '../../api'
import { EmptyState, Field, Modal, Notice, PageHeading, Panel, Status } from '../../components/UI'
import type { SharedPageProps } from '../../app/types'

type Section = 'objectives' | 'policies' | 'approvals' | 'shadow'
type Props = SharedPageProps & { section: Section; onNavigate?: (page: 'automation') => void }

export default function GovernancePages(props: Props) {
  if (props.section === 'objectives') return <ObjectivesPage {...props} />
  if (props.section === 'policies') return <PoliciesPage {...props} />
  if (props.section === 'approvals') return <ApprovalsPage {...props} />
  return <ShadowPage {...props} onNavigate={props.onNavigate} />
}

function ObjectivesPage({ data, errors, loading, canManage, onRefresh, notify }: SharedPageProps) {
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Objective | null>(null)
  const [working, setWorking] = useState('')

  async function save(payload: ObjectiveDraft) {
    if (editing) {
      await voytekApi.updateObjective(editing.id, {
        name: payload.name,
        description: payload.description,
        startDate: payload.startDate,
        endDate: payload.endDate,
      })
      notify('Objetivo atualizado.')
    } else {
      await voytekApi.createObjective(payload)
      notify('Objetivo criado em rascunho.')
    }
    await onRefresh()
    setFormOpen(false)
    setEditing(null)
  }

  async function changeState(item: Objective, action: 'activate' | 'complete') {
    setWorking(item.id)
    try {
      await voytekApi.changeObjectiveState(item.id, action)
      await onRefresh()
      notify(action === 'activate' ? 'Objetivo ativado.' : 'Objetivo concluído.')
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : 'Não foi possível alterar o objetivo.', 'error')
    } finally {
      setWorking('')
    }
  }

  return (
    <div className="v-page">
      <PageHeading title="Objetivos" description="Cada agente trabalha em direção a um resultado definido e verificável." action={canManage && <button className="v-primary-button" onClick={() => { setEditing(null); setFormOpen(true) }} type="button">Novo objetivo</button>} />
      {errors.objectives && <Notice tone="error">{errors.objectives}</Notice>}
      <Panel title="Objetivos da organização" description="Um objetivo associa o propósito do agente a uma janela de acompanhamento.">
        {loading && data.objectives.length === 0 ? <div className="v-loading-line">Carregando objetivos…</div> : data.objectives.length === 0 ? (
          <EmptyState title={errors.objectives ? 'Não foi possível carregar objetivos' : 'Nenhum objetivo cadastrado'} description={errors.objectives ? 'Confira a conexão e tente novamente.' : canManage ? 'Crie um objetivo para associar uma finalidade clara a um agente.' : 'Peça a um Owner, Admin ou Manager para cadastrar o objetivo.'} action={!errors.objectives && canManage && <button className="v-primary-button" onClick={() => setFormOpen(true)} type="button">Criar objetivo</button>} />
        ) : (
          <div className="v-table-wrap"><table className="v-table">
            <thead><tr><th>Objetivo</th><th>Agente</th><th>Status</th><th>Início</th><th>Fim</th>{canManage && <th>Ações</th>}</tr></thead>
            <tbody>{data.objectives.map(item => {
              const agent = data.agents.find(candidate => candidate.id === item.agentId)
              return <tr key={item.id}>
                <td><strong>{item.name}</strong><small className="v-cell-detail">{item.description}</small></td>
                <td>{agent?.name ?? item.agentId.slice(0, 8)}</td>
                <td><Status value={item.status} /></td>
                <td>{item.startDate}</td>
                <td>{item.endDate ?? 'Sem data final'}</td>
                {canManage && <td><div className="v-row-actions">
                  <button disabled={working === item.id} onClick={() => { setEditing(item); setFormOpen(true) }} type="button">Editar</button>
                  {item.status.toLowerCase() === 'draft' && <button disabled={working === item.id} onClick={() => void changeState(item, 'activate')} type="button">Ativar</button>}
                  {item.status.toLowerCase() === 'active' && <button disabled={working === item.id} onClick={() => void changeState(item, 'complete')} type="button">Concluir</button>}
                </div></td>}
              </tr>
            })}</tbody>
          </table></div>
        )}
      </Panel>
      {formOpen && <Modal title={editing ? 'Editar objetivo' : 'Novo objetivo'} description="A API valida vínculo com o agente e o período informado." onClose={() => { setFormOpen(false); setEditing(null) }}>
        <ObjectiveForm agents={data.agents} initial={editing} onSubmit={save} onCancel={() => { setFormOpen(false); setEditing(null) }} />
      </Modal>}
    </div>
  )
}

type ObjectiveDraft = { agentId: string; name: string; description: string; startDate: string; endDate?: string | null }

function ObjectiveForm({ agents, initial, onSubmit, onCancel }: {
  agents: { id: string; name: string }[]
  initial: Objective | null
  onSubmit: (draft: ObjectiveDraft) => Promise<void>
  onCancel: () => void
}) {
  const [agentId, setAgentId] = useState(initial?.agentId ?? agents[0]?.id ?? '')
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [startDate, setStartDate] = useState(initial?.startDate ?? new Date().toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState(initial?.endDate ?? '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!agentId) return setError('Crie um agente antes de associar o objetivo.')
    if (endDate && endDate < startDate) return setError('A data final não pode ser anterior à data inicial.')
    setError('')
    setBusy(true)
    try {
      await onSubmit({ agentId, name: name.trim(), description: description.trim(), startDate, endDate: endDate || null })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar o objetivo.')
    } finally {
      setBusy(false)
    }
  }

  return <form className="v-form-stack" onSubmit={submit}>
    <Field label="Agente" hint={initial ? 'O agente associado não pode ser alterado pela API atual.' : undefined}><select disabled={Boolean(initial)} required value={agentId} onChange={event => setAgentId(event.target.value)}><option value="">Selecione</option>{agents.map(agent => <option value={agent.id} key={agent.id}>{agent.name}</option>)}</select></Field>
    <Field label="Nome do objetivo"><input maxLength={200} required value={name} onChange={event => setName(event.target.value)} placeholder="Ex.: reduzir custos de cloud" /></Field>
    <Field label="Descrição"><textarea maxLength={4000} rows={3} value={description} onChange={event => setDescription(event.target.value)} placeholder="Como será considerado um bom resultado?" /></Field>
    <div className="v-form-grid">
      <Field label="Data inicial"><input type="date" required value={startDate} onChange={event => setStartDate(event.target.value)} /></Field>
      <Field label="Data final"><input type="date" value={endDate} onChange={event => setEndDate(event.target.value)} /></Field>
    </div>
    {error && <p className="v-form-error" role="alert">{error}</p>}
    <div className="v-form-actions"><button className="v-secondary-button" onClick={onCancel} type="button">Cancelar</button><button className="v-primary-button" disabled={busy || agents.length === 0} type="submit">{busy ? 'Salvando…' : 'Salvar objetivo'}</button></div>
  </form>
}

function PoliciesPage({ data, errors, loading, canManage, onRefresh, notify }: SharedPageProps) {
  const [formOpen, setFormOpen] = useState(false)
  const [working, setWorking] = useState('')

  async function create(payload: { agentId: string; name: string; actionType: string; maximumAmount: number | null; approvalThreshold: number | null }) {
    await voytekApi.createPolicy(payload)
    await onRefresh()
    setFormOpen(false)
    notify('Policy criada e ativada.')
  }

  async function deactivate(id: string) {
    if (!window.confirm('Desativar esta policy?')) return
    setWorking(id)
    try {
      await voytekApi.deactivatePolicy(id)
      await onRefresh()
      notify('Policy desativada.')
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : 'Não foi possível desativar a policy.', 'error')
    } finally {
      setWorking('')
    }
  }

  return <div className="v-page">
    <PageHeading title="Policies" description="Regras determinísticas que limitam ações e escalam exceções para pessoas." action={canManage && <button className="v-primary-button" onClick={() => setFormOpen(true)} type="button">Criar policy</button>} />
    <Notice tone="info">O agente não aprova a própria ação. A decisão final fica no policy engine da API.</Notice>
    {errors.policies && <Notice tone="error">{errors.policies}</Notice>}
    <Panel title="Regras ativas e inativas" description="Limites e thresholds configurados por agente.">
      {loading && data.policies.length === 0 ? <div className="v-loading-line">Carregando policies…</div> : data.policies.length === 0 ? (
        <EmptyState title={errors.policies ? 'Policies indisponíveis' : 'Nenhuma policy cadastrada'} description={errors.policies ? 'A API não retornou as regras.' : canManage ? 'Crie regras de valor máximo e aprovação humana para os agentes.' : 'Peça a um Owner, Admin ou Manager para configurar policies.'} action={!errors.policies && canManage && <button className="v-primary-button" onClick={() => setFormOpen(true)} type="button">Nova policy</button>} />
      ) : <div className="v-table-wrap"><table className="v-table">
        <thead><tr><th>Regra</th><th>Agente</th><th>Ação</th><th>Limite</th><th>Aprovação acima de</th><th>Status</th>{canManage && <th />}</tr></thead>
        <tbody>{data.policies.map(policy => {
          const agent = data.agents.find(item => item.id === policy.agentId)
          return <tr key={policy.id}>
            <td>{policy.name}</td><td>{agent?.name ?? policy.agentId.slice(0, 8)}</td><td>{policy.actionType}</td>
            <td>{policy.maximumAmount == null ? 'Sem limite configurado' : unqualifiedAmount(policy.maximumAmount)}</td>
            <td>{policy.approvalThreshold == null ? 'Sem threshold' : unqualifiedAmount(policy.approvalThreshold)}</td>
            <td><Status value={policy.isActive ? 'Active' : 'Disabled'} /></td>
            {canManage && <td>{policy.isActive && <button className="v-row-action-danger" disabled={working === policy.id} onClick={() => void deactivate(policy.id)} type="button">Desativar</button>}</td>}
          </tr>
        })}</tbody>
      </table></div>}
    </Panel>
    {formOpen && <Modal title="Criar policy" description="Limites sem valor permanecem não configurados; não serão inventadas regras padrão." onClose={() => setFormOpen(false)}>
      <PolicyForm agents={data.agents} onSubmit={create} onCancel={() => setFormOpen(false)} />
    </Modal>}
  </div>
}

function unqualifiedAmount(value: number) {
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value) + ' (moeda não definida)'
}

function PolicyForm({ agents, onSubmit, onCancel }: {
  agents: { id: string; name: string }[]
  onSubmit: (policy: { agentId: string; name: string; actionType: string; maximumAmount: number | null; approvalThreshold: number | null }) => Promise<void>
  onCancel: () => void
}) {
  const [agentId, setAgentId] = useState(agents[0]?.id ?? '')
  const [name, setName] = useState('')
  const [actionType, setActionType] = useState('purchase')
  const [maximumAmount, setMaximumAmount] = useState('')
  const [approvalThreshold, setApprovalThreshold] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const max = maximumAmount ? Number(maximumAmount) : null
    const threshold = approvalThreshold ? Number(approvalThreshold) : null
    if (!agentId) return setError('Selecione um agente.')
    if ((max !== null && (!Number.isFinite(max) || max <= 0)) || (threshold !== null && (!Number.isFinite(threshold) || threshold <= 0))) return setError('Os limites informados devem ser maiores que zero.')
    if (max !== null && threshold !== null && threshold > max) return setError('O threshold de aprovação não pode superar o limite máximo.')
    setError('')
    setBusy(true)
    try {
      await onSubmit({ agentId, name: name.trim(), actionType: actionType.trim(), maximumAmount: max, approvalThreshold: threshold })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível criar a policy.')
    } finally {
      setBusy(false)
    }
  }

  return <form className="v-form-stack" onSubmit={submit}>
    <Field label="Agente"><select required value={agentId} onChange={event => setAgentId(event.target.value)}><option value="">Selecione</option>{agents.map(agent => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select></Field>
    <Field label="Nome da regra"><input maxLength={150} required value={name} onChange={event => setName(event.target.value)} placeholder="Ex.: Compras até R$ 500" /></Field>
    <Field label="Tipo de ação"><input maxLength={100} required value={actionType} onChange={event => setActionType(event.target.value)} placeholder="purchase" /></Field>
    <div className="v-form-grid">
      <Field label="Valor máximo (opcional)" hint="A API atual não associa uma moeda a este limite."><input min="0.01" step="0.01" type="number" value={maximumAmount} onChange={event => setMaximumAmount(event.target.value)} placeholder="Sem limite" /></Field>
      <Field label="Aprovação acima de (opcional)" hint="A API atual não associa uma moeda a este threshold."><input min="0.01" step="0.01" type="number" value={approvalThreshold} onChange={event => setApprovalThreshold(event.target.value)} placeholder="Sem threshold" /></Field>
    </div>
    {error && <p className="v-form-error" role="alert">{error}</p>}
    <div className="v-form-actions"><button className="v-secondary-button" onClick={onCancel} type="button">Cancelar</button><button className="v-primary-button" disabled={busy || agents.length === 0} type="submit">{busy ? 'Salvando…' : 'Criar policy'}</button></div>
  </form>
}

function ApprovalsPage({ data, errors, loading, canManage, onRefresh, notify }: SharedPageProps) {
  const [filter, setFilter] = useState('pending')
  const [working, setWorking] = useState('')
  const filtered = data.approvals.filter(item => filter === 'all' || (filter === 'pending' ? isPending(item.status) : String(item.status).toLowerCase() === filter))

  async function decide(id: string, action: 'approve' | 'reject') {
    setWorking(id)
    try {
      if (action === 'approve') await voytekApi.approveApproval(id)
      else await voytekApi.rejectApproval(id)
      await onRefresh()
      notify(action === 'approve' ? 'Aprovação registrada.' : 'Solicitação rejeitada.')
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : 'Não foi possível decidir a solicitação.', 'error')
    } finally {
      setWorking('')
    }
  }

  return <div className="v-page">
    <PageHeading title="Aprovações" description="Decida exceções escaladas pelo policy engine; ações são registradas na auditoria." />
    {errors.approvals && <Notice tone="error">{errors.approvals}</Notice>}
    <div className="v-filter-row">
      <label>Mostrar <select value={filter} onChange={event => setFilter(event.target.value)}><option value="pending">Pendentes</option><option value="approved">Aprovadas</option><option value="rejected">Rejeitadas</option><option value="all">Todas</option></select></label>
      <span>{errors.approvals ? 'Dados indisponíveis' : filtered.length + ' solicitação(ões)'}</span>
    </div>
    <Panel title="Solicitações de aprovação" description="A decisão só pode ser executada por um usuário com permissão na organização.">
      {loading && data.approvals.length === 0 ? <div className="v-loading-line">Carregando aprovações…</div> : filtered.length === 0 ? (
        <EmptyState title={errors.approvals ? 'Aprovações indisponíveis' : 'Nenhuma solicitação nesta visão'} description={errors.approvals ? 'Confira a conexão da API.' : 'Uma ação acima das regras configuradas aparecerá aqui para análise.'} />
      ) : <div className="v-approval-list">{filtered.map(item => (
        <article className="v-approval-row" key={item.id}>
          <div className="v-approval-copy"><strong>Solicitação {item.id.slice(0, 8)}</strong><small>Autorização <code>{item.authorizationRequestId}</code></small><small>Criada em {new Date(item.createdAtUtc).toLocaleString('pt-BR')}</small></div>
          <Status value={item.status} />
          {canManage && isPending(item.status) && <div className="v-row-actions">
            <button className="v-approve-button" disabled={working === item.id} onClick={() => void decide(item.id, 'approve')} type="button">Aprovar</button>
            <button className="v-row-action-danger" disabled={working === item.id} onClick={() => void decide(item.id, 'reject')} type="button">Rejeitar</button>
          </div>}
        </article>
      ))}</div>}
    </Panel>
  </div>
}

function isPending(status: string | number) {
  return status === 0 || String(status).toLowerCase() === 'pending'
}

function ShadowPage({ data, errors, loading, onNavigate }: SharedPageProps & { onNavigate?: (page: 'automation') => void }) {
  const rows = [...data.shadowActions].sort((a, b) => b.createdAtUtc.localeCompare(a.createdAtUtc))
  return <div className="v-page">
    <PageHeading title="Shadow Mode" description="Simule ações pelo mesmo motor de autorização, sem chamar executores externos." action={<button className="v-primary-button" onClick={() => onNavigate?.('automation')} type="button">Nova simulação</button>} />
    <Notice tone="warning">Shadow Mode avalia policies e registra o que aconteceria. Não representa pagamento, transferência ou execução externa.</Notice>
    {errors.shadowActions && <Notice tone="error">{errors.shadowActions}</Notice>}
    <Panel title="Ações simuladas" description="Cada registro aponta para a autorização que originou a simulação.">
      {loading && rows.length === 0 ? <div className="v-loading-line">Carregando simulações…</div> : errors.shadowActions ? <EmptyState title="Dados indisponíveis" description="A API não retornou ações de Shadow Mode." /> : rows.length === 0 ? <EmptyState title="Nenhuma simulação registrada" description="Abra Automações, selecione agente, objetivo e budget, depois avalie uma ação em Shadow Mode." action={<button className="v-secondary-button" onClick={() => onNavigate?.('automation')} type="button">Ir para automações</button>} /> : (
        <div className="v-table-wrap"><table className="v-table"><thead><tr><th>Decisão</th><th>Autorização</th><th>Registrada em</th></tr></thead><tbody>{rows.map(item => <tr key={item.id}><td><Status value={decisionLabel(item.decision)} /></td><td><code>{item.authorizationRequestId}</code></td><td>{new Date(item.createdAtUtc).toLocaleString('pt-BR')}</td></tr>)}</tbody></table></div>
      )}
    </Panel>
  </div>
}

function decisionLabel(value: string | number) {
  if (typeof value === 'number') return ['Allow', 'Deny', 'HumanApproval'][value] ?? String(value)
  return value
}
