import { Notice, PageHeading, Panel } from '../../components/UI'
import type { PageId } from '../../app/navigation'

type RoadmapSection = Extract<PageId, 'cards' | 'vault' | 'commerce'>

const content: Record<RoadmapSection, { title: string; description: string; status: string; notes: string[] }> = {
  cards: {
    title: 'Cartões e pagamentos',
    description: 'Emissão de cartões virtuais e pagamentos reais não estão habilitados neste MVP.',
    status: 'Planejado · depende de parceiro financeiro, regras de compliance e execução segura.',
    notes: [
      'Budgets e carteiras lógicas desta aplicação não são fundos custodiados.',
      'Não há número de cartão, credencial bancária nem rail de pagamento nesta tela.',
      'As autorizações existentes avaliam regras; Shadow Mode não efetua compras.',
    ],
  },
  vault: {
    title: 'Cofre de acessos',
    description: 'Um futuro cofre poderá gerenciar credenciais e segredos com acesso de menor privilégio.',
    status: 'Planejado · ainda não existe armazenamento seguro de senhas no backend.',
    notes: [
      'Não digite ou salve senhas reais nesta aplicação.',
      'Esta tela não guarda credenciais em localStorage, no navegador ou na API.',
      'A futura integração deve entregar referência/escopo ao agente, não o segredo bruto.',
    ],
  },
  commerce: {
    title: 'Agent commerce',
    description: 'Negociações entre agentes são uma extensão experimental, ainda sem rotas de interface na API atual.',
    status: 'Planejado · nenhuma proposta ou transação entre agentes é criada nesta tela.',
    notes: [
      'O roadmap prevê buyer/seller agents e status de negociação.',
      'O escopo atual não conecta empresas diferentes nem liquida operações.',
      'Para validar a governança hoje, use propostas e autorizações em Shadow Mode.',
    ],
  },
}

export default function RoadmapPage({ section }: { section: RoadmapSection }) {
  const feature = content[section]
  return <div className="v-page">
    <PageHeading eyebrow="ROADMAP VOYTEK" title={feature.title} description={feature.description} />
    <Notice tone="warning">{feature.status}</Notice>
    <Panel title="Escopo e segurança" description="A área aparece na navegação para indicar onde a capacidade ficará, mas não simula operação financeira ou armazenamento de segredos.">
      <ul className="v-roadmap-list">{feature.notes.map(note => <li key={note}>{note}</li>)}</ul>
    </Panel>
    <div className="v-roadmap-footnote">Quando esta capacidade entrar em desenvolvimento, ela deverá receber seu próprio contrato de API, autorização, armazenamento e auditoria antes de ser ativada no produto.</div>
  </div>
}
