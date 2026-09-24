import { useCallback, useEffect, useState, type ReactNode } from 'react'
import {
  API_BASE_URL,
  checkApiHealth,
  currentMembership,
  voytekApi,
  type ApiCredential,
  type Agent,
  type Approval,
  type AuditEvent,
  type Budget,
  type LedgerEntry,
  type Objective,
  type Outcome,
  type Policy,
  type SaasRecommendation,
  type SaasSubscription,
  type ShadowAction,
} from '../api'
import { Notice } from '../components/UI'
import AgentsPage from '../features/agents/AgentsPage'
import AutomationPage from '../features/automation/AutomationPage'
import DashboardPage from '../features/dashboard/DashboardPage'
import FinancePages from '../features/finance/FinancePages'
import GovernancePages from '../features/governance/GovernancePages'
import RoadmapPage from '../features/roadmap/RoadmapPage'
import AccessPage from '../features/settings/AccessPage'
import SettingsPage from '../features/settings/SettingsPage'
import HeaderNavigation, { type PageId } from './navigation'
import { emptyWorkspaceData, type DataErrors, type NoticeTone, type WorkspaceData } from './types'

type WorkspaceProps = { onLogout: () => void }
type Toast = { message: string; tone: NoticeTone }

async function safeLoad<T>(loader: () => Promise<T>) {
  try {
    return { data: await loader(), error: '' }
  } catch (cause) {
    return { data: null as T | null, error: cause instanceof Error ? cause.message : 'Falha ao carregar os dados.' }
  }
}

export default function Workspace({ onLogout }: WorkspaceProps) {
  const [activePage, setActivePage] = useState<PageId>('overview')
  const [focusedAgentId, setFocusedAgentId] = useState<string | null>(null)
  const [data, setData] = useState<WorkspaceData>(emptyWorkspaceData)
  const [errors, setErrors] = useState<DataErrors>({})
  const [loading, setLoading] = useState(true)
  const [apiOnline, setApiOnline] = useState(false)
  const [saasAnalysisDone, setSaasAnalysisDone] = useState(false)
  const [saasRecommendations, setSaasRecommendations] = useState<SaasRecommendation[] | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)
  const email = localStorage.getItem('voytek.email') ?? ''
  const membership = currentMembership()
  const role = membership?.role ?? 'Viewer'
  const canManage = ['Owner', 'Admin', 'Manager'].includes(role)
  const canAdmin = ['Owner', 'Admin'].includes(role)

  const notify = useCallback((message: string, tone: NoticeTone = 'success') => {
    setToast({ message, tone })
  }, [])
  const completeSaasAnalysis = useCallback((recommendations: SaasRecommendation[]) => {
    setSaasRecommendations(recommendations)
    setSaasAnalysisDone(true)
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    const [
      agents,
      objectives,
      budgets,
      policies,
      approvals,
      shadowActions,
      ledger,
      audit,
      outcomes,
      saasSubscriptions,
      apiCredentials,
      health,
    ] = await Promise.all([
      safeLoad<Agent[]>(voytekApi.listAgents),
      safeLoad<Objective[]>(voytekApi.listObjectives),
      safeLoad<Budget[]>(voytekApi.listBudgets),
      safeLoad<Policy[]>(voytekApi.listPolicies),
      safeLoad<Approval[]>(voytekApi.listApprovals),
      safeLoad<ShadowAction[]>(voytekApi.listShadowActions),
      safeLoad<LedgerEntry[]>(voytekApi.listLedger),
      safeLoad<AuditEvent[]>(voytekApi.listAudit),
      safeLoad<Outcome[]>(voytekApi.listOutcomes),
      safeLoad<SaasSubscription[]>(voytekApi.listSaasSubscriptions),
      canAdmin ? safeLoad<ApiCredential[]>(voytekApi.listApiCredentials) : Promise.resolve({ data: [] as ApiCredential[], error: '' }),
      safeLoad(checkApiHealth),
    ])

    setData({
      agents: agents.data ?? [],
      objectives: objectives.data ?? [],
      budgets: budgets.data ?? [],
      policies: policies.data ?? [],
      approvals: approvals.data ?? [],
      shadowActions: shadowActions.data ?? [],
      ledger: ledger.data ?? [],
      audit: audit.data ?? [],
      outcomes: outcomes.data ?? [],
      saasSubscriptions: saasSubscriptions.data ?? [],
      apiCredentials: apiCredentials.data ?? [],
    })
    setErrors({
      ...(agents.error ? { agents: agents.error } : {}),
      ...(objectives.error ? { objectives: objectives.error } : {}),
      ...(budgets.error ? { budgets: budgets.error } : {}),
      ...(policies.error ? { policies: policies.error } : {}),
      ...(approvals.error ? { approvals: approvals.error } : {}),
      ...(shadowActions.error ? { shadowActions: shadowActions.error } : {}),
      ...(ledger.error ? { ledger: ledger.error } : {}),
      ...(audit.error ? { audit: audit.error } : {}),
      ...(outcomes.error ? { outcomes: outcomes.error } : {}),
      ...(saasSubscriptions.error ? { saasSubscriptions: saasSubscriptions.error } : {}),
      ...(apiCredentials.error ? { apiCredentials: apiCredentials.error } : {}),
    })
    setApiOnline(health.data === true)
    setLoading(false)
  }, [canAdmin])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [activePage])

  useEffect(() => {
    if (!toast) return
    const timeoutId = window.setTimeout(() => setToast(null), 4200)
    return () => window.clearTimeout(timeoutId)
  }, [toast])

  const sharedProps = {
    data,
    errors,
    loading,
    role,
    canManage,
    canAdmin,
    saasAnalysisDone,
    saasRecommendations,
    onSaasAnalysisCompleted: completeSaasAnalysis,
    onRefresh: refresh,
    notify,
  }
  const navigate = (page: PageId) => {
    setFocusedAgentId(null)
    setActivePage(page)
  }
  const openAgent = (agentId: string) => {
    setFocusedAgentId(agentId)
    setActivePage('agents')
  }
  let pageContent: ReactNode
  switch (activePage) {
    case 'overview':
      pageContent = <DashboardPage {...sharedProps} onNavigate={navigate} onOpenAgent={openAgent} />
      break
    case 'agents':
      pageContent = <AgentsPage {...sharedProps} onNavigate={navigate} focusedAgentId={focusedAgentId} onFocusHandled={() => setFocusedAgentId(null)} />
      break
    case 'objectives':
      pageContent = <GovernancePages {...sharedProps} section="objectives" />
      break
    case 'policies':
      pageContent = <GovernancePages {...sharedProps} section="policies" />
      break
    case 'approvals':
      pageContent = <GovernancePages {...sharedProps} section="approvals" />
      break
    case 'shadow':
      pageContent = <GovernancePages {...sharedProps} section="shadow" onNavigate={() => setActivePage('automation')} />
      break
    case 'automation':
      pageContent = <AutomationPage {...sharedProps} />
      break
    case 'wallet':
      pageContent = <FinancePages {...sharedProps} section="wallet" />
      break
    case 'ledger':
      pageContent = <FinancePages {...sharedProps} section="ledger" />
      break
    case 'outcomes':
      pageContent = <FinancePages {...sharedProps} section="outcomes" />
      break
    case 'audit':
      pageContent = <FinancePages {...sharedProps} section="audit" />
      break
    case 'credentials':
      pageContent = <SettingsPage {...sharedProps} />
      break
    case 'access':
      pageContent = <AccessPage {...sharedProps} />
      break
    case 'cards':
    case 'vault':
    case 'commerce':
      pageContent = <RoadmapPage section={activePage} />
      break
  }

  return (
    <div className="voytek-app">
      <HeaderNavigation activePage={activePage} onNavigate={navigate} onLogout={onLogout} email={email} canAdmin={canAdmin} apiOnline={apiOnline} loading={loading} onRefresh={() => void refresh()} />
      <main className="voytek-main">
        {!apiOnline && (
          <div className="voytek-api-banner">
            <Notice tone="warning">
              A API ainda não respondeu em <code>{API_BASE_URL}</code>. As telas ficam disponíveis, mas os dados e ações dependem dela.
            </Notice>
          </div>
        )}
        <div className="voytek-content" key={activePage}>
          {pageContent}
        </div>
        <footer className="voytek-footer">
          <span>Voytek · Controle para operações com agentes</span>
          <span>{membership?.role ? 'Acesso: ' + membership.role : 'Acesso autenticado'}</span>
        </footer>
      </main>
      {toast && <div className={'v-toast is-' + toast.tone} role={toast.tone === 'error' ? 'alert' : 'status'}>{toast.message}</div>}
    </div>
  )
}
