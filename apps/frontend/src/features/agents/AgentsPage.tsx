import { useEffect, useState } from 'react'
import { voytekApi, type Agent, type Budget, type LedgerEntry, type Objective, type Outcome, type Policy } from '../../api'
import { EmptyState, Modal, Notice, PageHeading, Panel, Status } from '../../components/UI'
import type { PageId } from '../../app/navigation'
import type { SharedPageProps } from '../../app/types'
import AgentForm, { type AgentDraft } from './AgentForm'

type Props = SharedPageProps & {
  onNavigate?: (page: PageId) => void
  focusedAgentId?: string | null
  onFocusHandled?: () => void
}

function autonomyLabel(value: string) {
  const labels: Record<string, string> = { manual: 'Manual', supervised: 'Supervisionada', autonomous: 'Autônoma' }
  return labels[value.toLowerCase()] ?? value
}

function specializationLabel(value: string) {
  const labels: Record<string, string> = {
    Custom: 'Personalizado',
    SaasManagement: 'Gestão de SaaS',
    Procurement: 'Compras e fornecedores',
    EpiInventory: 'Estoque de EPI',
    CloudCost: 'Custos de cloud',
    Marketing: 'Marketing',
    CorporateTravel: 'Viagens corporativas',
    AccountsPayable: 'Contas a pagar',
    ItOperations: 'Operações de TI',
  }
  return labels[value] ?? value
}

export default function AgentsPage({ data, errors, loading, canManage, onRefresh, notify, onNavigate, focusedAgentId, onFocusHandled }: Props) {
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<Agent | null>(null)
  const [selected, setSelected] = useState<Agent | null>(null)
  const [working, setWorking] = useState('')

  useEffect(() => {
    if (!focusedAgentId) return
    const agent = data.agents.find(item => item.id === focusedAgentId)
    if (!agent) return
    setSelected(agent)
    onFocusHandled?.()
  }, [data.agents, focusedAgentId, onFocusHandled])

  async function createAgent(draft: AgentDraft) {
    await voytekApi.createAgent(draft)
    await onRefresh()
    notify('Agente criado; seu objetivo inicial ficou em rascunho.')
    setCreateOpen(false)
  }

  async function updateAgent(draft: AgentDraft) {
    if (!editing) return
    await voytekApi.updateAgent(editing.id, {
      name: draft.name,
      description: draft.description,
      autonomyLevel: draft.autonomyLevel,
    })
    await onRefresh()
    notify('Agente atualizado.')
    setEditing(null)
  }

  async function changeState(agent: Agent, action: 'activate' | 'suspend' | 'disable' | 'kill-switch/activate' | 'kill-switch/deactivate') {
    const messages: Record<typeof action, string> = {
      activate: 'Ativar este agente?',
      suspend: 'Suspender este agente? Ele deixará de iniciar novas ações sensíveis.',
      disable: 'Desativar este agente? Esta ação pode impedir novas operações.',
      'kill-switch/activate': 'Acionar o kill switch? Novas autorizações serão bloqueadas.',
      'kill-switch/deactivate': 'Desativar o kill switch deste agente?',
    }
    if (!window.confirm(messages[action])) return
    setWorking(agent.id + action)
    try {
      await voytekApi.changeAgentState(agent.id, action)
      await onRefresh()
      notify(action.includes('kill-switch') ? 'Kill switch atualizado.' : 'Estado do agente atualizado.')
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : 'Não foi possível alterar o agente.', 'error')
    } finally {
      setWorking('')
    }
  }

  return (
    <div className="v-page">
      <PageHeading
        title="Agentes"
        description="Crie identidades operacionais, associe objetivos e escolha limites de autonomia."
        action={canManage && <button className="v-primary-button" onClick={() => setCreateOpen(true)} type="button">Criar agente</button>}
      />
      {errors.agents && <Notice tone="error">{errors.agents}</Notice>}
      <Panel title="Agentes da organização" description="Status, especialização e autonomia vêm da API Voytek.">
        {loading && data.agents.length === 0 ? (
          <div className="v-loading-line">Carregando agentes…</div>
        ) : data.agents.length === 0 ? (
          <EmptyState
            title={errors.agents ? 'Agentes indisponíveis' : 'Ainda não há agentes'}
            description={errors.agents ? 'Conecte a API e tente atualizar.' : 'Crie um agente para começar. O primeiro objetivo será salvo em rascunho.'}
            action={!errors.agents && canManage && <button className="v-primary-button" onClick={() => setCreateOpen(true)} type="button">Criar agente</button>}
          />
        ) : (
          <div className="v-table-wrap">
            <table className="v-table">
              <thead><tr><th>Agente</th><th>Objetivo</th><th>Autonomia</th><th>Status</th>{canManage && <th>Ações</th>}</tr></thead>
              <tbody>{data.agents.map(agent => {
                const objective = data.objectives.find(item => item.agentId === agent.id)
                const busy = working.startsWith(agent.id)
                const killActive = Boolean(agent.killSwitchActivatedAtUtc)
                return (
                  <tr key={agent.id}>
                    <td>
                      <button className="v-table-link" onClick={() => setSelected(agent)} type="button">{agent.name}</button>
                      <small className="v-cell-detail">{specializationLabel(agent.specialization)}</small>
                    </td>
                    <td>{objective?.name ?? 'Sem objetivo associado'}</td>
                    <td>{autonomyLabel(agent.autonomyLevel)}</td>
                    <td><Status value={killActive ? 'Suspended' : agent.status} /></td>
                    {canManage && <td>
                      <div className="v-row-actions">
                        <button disabled={busy} onClick={() => setEditing(agent)} type="button">Editar</button>
                        {agent.status.toLowerCase() === 'active'
                          ? <button disabled={busy} onClick={() => void changeState(agent, 'suspend')} type="button">Suspender</button>
                          : agent.status.toLowerCase() !== 'disabled' && <button disabled={busy} onClick={() => void changeState(agent, 'activate')} type="button">Ativar</button>}
                        {agent.status.toLowerCase() !== 'disabled' && <button className="is-danger" disabled={busy} onClick={() => void changeState(agent, 'disable')} type="button">Desativar</button>}
                        <button className={killActive ? 'is-danger' : ''} disabled={busy} onClick={() => void changeState(agent, killActive ? 'kill-switch/deactivate' : 'kill-switch/activate')} type="button">
                          {killActive ? 'Liberar kill switch' : 'Kill switch'}
                        </button>
                      </div>
                    </td>}
                  </tr>
                )
              })}</tbody>
            </table>
          </div>
        )}
      </Panel>

      {createOpen && (
        <Modal title="Criar agente" description="O agente começa em rascunho e não executa ações externas por conta própria." onClose={() => setCreateOpen(false)}>
          <AgentForm onSubmit={createAgent} onCancel={() => setCreateOpen(false)} />
        </Modal>
      )}
      {editing && (
        <Modal title="Editar agente" description="O estado e as policies continuam sendo aplicados pela API." onClose={() => setEditing(null)}>
          <AgentForm initialAgent={editing} specializationEditable={false} onSubmit={updateAgent} onCancel={() => setEditing(null)} />
        </Modal>
      )}
      {selected && (
        <Modal title={selected.name} description={selected.description ?? 'Sem descrição registrada.'} onClose={() => setSelected(null)}>
          <AgentDetails
            agent={selected}
            objectives={data.objectives}
            budgets={data.budgets}
            policies={data.policies}
            ledger={data.ledger}
            outcomes={data.outcomes}
            loading={loading}
            canManage={canManage}
            onGoAutomation={() => { setSelected(null); onNavigate?.('automation') }}
          />
        </Modal>
      )}
    </div>
  )
}

function AgentDetails({
  agent,
  objectives,
  budgets,
  policies,
  ledger,
  outcomes,
  loading,
  canManage,
  onGoAutomation,
}: {
  agent: Agent
  objectives: Objective[]
  budgets: Budget[]
  policies: Policy[]
  ledger: LedgerEntry[]
  outcomes: Outcome[]
  loading: boolean
  canManage: boolean
  onGoAutomation: () => void
}) {
  const relatedObjectives = objectives.filter(item => item.agentId === agent.id)
  const relatedBudgets = budgets.filter(item => item.agentId === agent.id)
  const relatedPolicies = policies.filter(item => item.agentId === agent.id)
  const relatedLedger = ledger.filter(item => item.agentId === agent.id).sort((a, b) => b.createdAtUtc.localeCompare(a.createdAtUtc)).slice(0, 3)
  const relatedOutcomes = outcomes.filter(item => item.agentId === agent.id).slice(0, 3)

  return (
    <div className="v-agent-detail">
      <div className="v-detail-facts">
        <div><small>Status</small><Status value={agent.killSwitchActivatedAtUtc ? 'Suspended' : agent.status} /></div>
        <div><small>Autonomia</small><strong>{autonomyLabel(agent.autonomyLevel)}</strong></div>
        <div><small>Especialização</small><strong>{specializationLabel(agent.specialization)}</strong></div>
        <div><small>Kill switch</small><strong>{agent.killSwitchActivatedAtUtc ? 'Ativo' : 'Inativo'}</strong></div>
      </div>
      <section><h3>Objetivos</h3>{relatedObjectives.length ? relatedObjectives.map((item: Objective) => <p key={item.id}>{item.name} · <Status value={item.status} /></p>) : <p className="v-muted">Nenhum objetivo carregado.</p>}</section>
      <section><h3>Budgets lógicos</h3>{relatedBudgets.length ? relatedBudgets.map((item: Budget) => <p key={item.id}>{item.name} · {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: item.currency }).format(item.availableAmount)} disponíveis</p>) : <p className="v-muted">Nenhum budget associado.</p>}</section>
      <section><h3>Policies</h3>{relatedPolicies.length ? relatedPolicies.map(item => <p key={item.id}>{item.name} · {item.actionType} · {item.isActive ? 'ativa' : 'inativa'}</p>) : <p className="v-muted">Nenhuma policy carregada.</p>}</section>
      <section><h3>Ledger recente</h3>{relatedLedger.length ? relatedLedger.map(item => <p key={item.id}>{item.type} · {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: item.currency }).format(item.amount)}</p>) : <p className="v-muted">Nenhum lançamento associado.</p>}</section>
      <section><h3>Resultados</h3>{relatedOutcomes.length ? relatedOutcomes.map(item => <p key={item.id}>{item.metric}: {item.value} {item.unit}</p>) : <p className="v-muted">Nenhum outcome registrado.</p>}</section>
      {loading && <small className="v-muted">Atualizando dados…</small>}
      {canManage && <button className="v-secondary-button" onClick={onGoAutomation} type="button">Propor uma ação para este agente</button>}
    </div>
  )
}
