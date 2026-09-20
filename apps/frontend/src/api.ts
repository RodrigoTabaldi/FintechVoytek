const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? 'http://localhost:8080'

export type Agent = {
  id: string
  name: string
  description?: string | null
  status: string
  autonomyLevel: string
  createdAtUtc: string
  updatedAtUtc: string
  killSwitchActivatedAtUtc?: string | null
}

export type AuthResponse = {
  accessToken: string
  userId: string
  memberships: { tenantId: string; role: string }[]
}

export type Objective = { id: string; agentId: string; name: string; description?: string; status: string; startDate?: string; endDate?: string | null }
export type Budget = { id: string; agentId: string; objectiveId?: string | null; name: string; totalAmount: number; availableAmount: number; currency: string; status: string }
export type Policy = { id: string; agentId: string; name: string; actionType: string; maximumAmount?: number | null; approvalThreshold?: number | null; status?: string }
export type AuthorizationResult = { id: string; decision: 'Allow' | 'Deny' | 'HumanApproval'; decisionReason: string; decidedAtUtc: string }
export type LedgerEntry = { id: string; agentId: string; amount: number; currency: string; entryType: string; createdAtUtc: string; reference?: string }
export type Approval = { id: string; authorizationRequestId: string; status: string; createdAtUtc: string }
export type AgentTemplate = { id: string; name: string; description: string; filters: string[] }
export type AgentSearchResult = { title: string; link: string; source: string; summary?: string | null; publishedAtUtc?: string | null }
export type AgentRunResponse = { agentId: string; templateId: string; query: string; executedAtUtc: string; results: AgentSearchResult[] }

type RequestOptions = RequestInit & { auth?: boolean }

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers)
  headers.set('Content-Type', 'application/json')
  const token = localStorage.getItem('voytek.accessToken')
  if (options.auth !== false && token) headers.set('Authorization', `Bearer ${token}`)
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers })
  } catch {
    throw new Error(`Não foi possível conectar à API Voytek em ${API_BASE_URL}. Verifique se o Docker está rodando.`)
  }
  if (!response.ok) {
    if (response.status === 403 && (options.method ?? 'GET').toUpperCase() === 'GET') {
      clearSession()
      window.location.reload()
      throw new Error('Sessão sem organização selecionada. Faça login novamente.')
    }
    const body = await response.json().catch(() => null) as { title?: string; detail?: string; errors?: Record<string, string[]> } | null
    const message = body?.detail ?? body?.title ?? Object.values(body?.errors ?? {}).flat()[0] ?? `Erro ${response.status}`
    throw new Error(message)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export const voytekApi = {
  register: (payload: { email: string; password: string; organizationName: string; organizationSlug: string }) => request<AuthResponse>('/api/v1/auth/register', { method: 'POST', body: JSON.stringify(payload), auth: false }),
  login: async (payload: { email: string; password: string }) => {
    const session = await request<AuthResponse>('/api/v1/auth/login', { method: 'POST', body: JSON.stringify(payload), auth: false })
    const membership = session.memberships[0]
    if (!membership) return session
    localStorage.setItem('voytek.accessToken', session.accessToken)
    return request<AuthResponse>('/api/v1/auth/select-tenant', { method: 'POST', body: JSON.stringify({ tenantId: membership.tenantId }) })
  },
  listAgents: () => request<Agent[]>('/api/v1/agents'),
  listObjectives: () => request<Objective[]>('/api/v1/objectives'),
  listBudgets: () => request<Budget[]>('/api/v1/budgets'),
  listPolicies: () => request<Policy[]>('/api/v1/policies'),
  listLedger: () => request<LedgerEntry[]>('/api/v1/ledger'),
  listApprovals: () => request<Approval[]>('/api/v1/approvals'),
  listAgentTemplates: () => request<AgentTemplate[]>('/api/v1/agent-templates'),
  runAgent: (agentId: string, payload: { templateId: string; query: string; filters: Record<string, string>; maxResults: number }) => request<AgentRunResponse>(`/api/v1/agents/${agentId}/run`, { method: 'POST', body: JSON.stringify(payload) }),
  approveApproval: (approvalId: string) => request<Approval>(`/api/v1/approvals/${approvalId}/approve`, { method: 'POST' }),
  rejectApproval: (approvalId: string) => request<Approval>(`/api/v1/approvals/${approvalId}/reject`, { method: 'POST' }),
  createAgent: (payload: { name: string; description: string; autonomyLevel: number }) => request<Agent>('/api/v1/agents', { method: 'POST', body: JSON.stringify(payload) }),
  activateAgent: (agentId: string) => request<Agent>(`/api/v1/agents/${agentId}/activate`, { method: 'POST' }),
  createObjective: (payload: { agentId: string; name: string; description: string; startDate: string; endDate?: string | null }) => request<Objective>('/api/v1/objectives', { method: 'POST', body: JSON.stringify(payload) }),
  activateObjective: (objectiveId: string) => request<Objective>(`/api/v1/objectives/${objectiveId}/activate`, { method: 'POST' }),
  createBudget: (payload: { agentId: string; objectiveId: string; name: string; totalAmount: number; currency: string }) => request<Budget>('/api/v1/budgets', { method: 'POST', body: JSON.stringify(payload) }),
  createPolicy: (payload: { agentId: string; name: string; actionType: string; maximumAmount: number; approvalThreshold: number }) => request<Policy>('/api/v1/policies', { method: 'POST', body: JSON.stringify(payload) }),
  authorize: (payload: { agentId: string; objectiveId: string; budgetId: string; actionType: string; amount: number; currency: string; purpose: string; idempotencyKey: string; shadowMode: boolean }) => request<AuthorizationResult>('/api/v1/authorizations', { method: 'POST', body: JSON.stringify(payload) }),
}

export function saveSession(session: AuthResponse) {
  localStorage.setItem('voytek.accessToken', session.accessToken)
  localStorage.setItem('voytek.userId', session.userId)
  localStorage.setItem('voytek.memberships', JSON.stringify(session.memberships))
}

export function clearSession() {
  localStorage.removeItem('voytek.accessToken')
  localStorage.removeItem('voytek.userId')
  localStorage.removeItem('voytek.memberships')
}

export function hasSession() { return Boolean(localStorage.getItem('voytek.accessToken')) }
