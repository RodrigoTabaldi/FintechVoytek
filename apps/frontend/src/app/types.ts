import type {
  Agent,
  ApiCredential,
  Approval,
  AuditEvent,
  Budget,
  LedgerEntry,
  Objective,
  Outcome,
  Policy,
  SaasSubscription,
  SaasRecommendation,
  ShadowAction,
} from '../api'

export type WorkspaceData = {
  agents: Agent[]
  objectives: Objective[]
  budgets: Budget[]
  policies: Policy[]
  approvals: Approval[]
  shadowActions: ShadowAction[]
  ledger: LedgerEntry[]
  audit: AuditEvent[]
  outcomes: Outcome[]
  saasSubscriptions: SaasSubscription[]
  apiCredentials: ApiCredential[]
}

export type DataErrors = Partial<Record<keyof WorkspaceData, string>>
export type NoticeTone = 'info' | 'error' | 'success' | 'warning'
export type Notify = (message: string, tone?: NoticeTone) => void
export type SharedPageProps = {
  data: WorkspaceData
  errors: DataErrors
  loading: boolean
  role: string
  canManage: boolean
  canAdmin: boolean
  saasAnalysisDone: boolean
  saasRecommendations: SaasRecommendation[] | null
  onSaasAnalysisCompleted: (recommendations: SaasRecommendation[]) => void
  onRefresh: () => Promise<void>
  notify: Notify
}

export const emptyWorkspaceData: WorkspaceData = {
  agents: [],
  objectives: [],
  budgets: [],
  policies: [],
  approvals: [],
  shadowActions: [],
  ledger: [],
  audit: [],
  outcomes: [],
  saasSubscriptions: [],
  apiCredentials: [],
}
