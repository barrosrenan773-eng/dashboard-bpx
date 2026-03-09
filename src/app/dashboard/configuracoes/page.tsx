import { Header } from '@/components/layout/Header'
import { CheckCircle, XCircle, AlertCircle, ExternalLink } from 'lucide-react'

const perfis = [
  { role: 'admin', label: 'Administrador', desc: 'Acesso total — vê tudo e pode configurar' },
  { role: 'gestor', label: 'Gestor', desc: 'Vê todos os canais e vendedores da sua equipe' },
  { role: 'vendedor', label: 'Vendedor', desc: 'Vê apenas seus próprios dados de performance' },
  { role: 'visualizador', label: 'Visualizador', desc: 'Somente leitura — sem acesso a dados financeiros' },
]

const integracoes = [
  {
    id: 'yampi',
    name: 'Yampi',
    desc: 'Checkout e pedidos do e-commerce',
    status: 'pending' as const,
    envVars: ['YAMPI_ALIAS', 'YAMPI_TOKEN', 'YAMPI_SECRET_KEY'],
    docsUrl: 'https://docs.yampi.io',
  },
  {
    id: 'clint',
    name: 'CLINT CRM',
    desc: 'Leads, vendedores e conversões do CRM',
    status: 'pending' as const,
    envVars: ['CLINT_API_KEY', 'CLINT_BASE_URL'],
    docsUrl: 'https://clint.digital',
  },
  {
    id: 'meta',
    name: 'Meta Ads',
    desc: 'Facebook e Instagram Ads — campanhas e investimento',
    status: 'pending' as const,
    envVars: ['META_ACCESS_TOKEN', 'META_AD_ACCOUNT_ID', 'META_APP_ID', 'META_APP_SECRET'],
    docsUrl: 'https://developers.facebook.com/docs/marketing-api',
  },
  {
    id: 'google',
    name: 'Google Ads',
    desc: 'Campanhas e palavras-chave do Google',
    status: 'pending' as const,
    envVars: ['GOOGLE_ADS_CLIENT_ID', 'GOOGLE_ADS_CLIENT_SECRET', 'GOOGLE_ADS_DEVELOPER_TOKEN', 'GOOGLE_ADS_CUSTOMER_ID', 'GOOGLE_ADS_REFRESH_TOKEN'],
    docsUrl: 'https://developers.google.com/google-ads/api/docs/start',
  },
  {
    id: 'shopee',
    name: 'Shopee',
    desc: 'Pedidos e receita do marketplace Shopee',
    status: 'pending' as const,
    envVars: ['SHOPEE_PARTNER_ID', 'SHOPEE_PARTNER_KEY', 'SHOPEE_SHOP_ID', 'SHOPEE_ACCESS_TOKEN'],
    docsUrl: 'https://open.shopee.com/documents',
  },
  {
    id: 'amazon',
    name: 'Amazon Seller',
    desc: 'Pedidos e receita da Amazon',
    status: 'pending' as const,
    envVars: ['AMAZON_SELLER_ID', 'AMAZON_MWS_ACCESS_KEY', 'AMAZON_MWS_SECRET_KEY', 'AMAZON_MARKETPLACE_ID'],
    docsUrl: 'https://developer-docs.amazon.com/sp-api',
  },
]

const statusConfig = {
  connected: { icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Conectado' },
  error: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10', label: 'Erro' },
  pending: { icon: AlertCircle, color: 'text-yellow-400', bg: 'bg-yellow-500/10', label: 'Pendente' },
}

export default function ConfiguracoesPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Configurações" />

      <div className="p-6 space-y-8">

        {/* Perfis de acesso */}
        <div className="max-w-2xl">
          <h2 className="text-white font-semibold text-base mb-4">Perfis de Acesso</h2>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <p className="text-zinc-500 text-sm mb-4">Cada usuário recebe um perfil que controla o que pode ver</p>
            <div className="space-y-3">
              {perfis.map((p) => (
                <div key={p.role} className="flex items-center gap-4 p-3 bg-zinc-800/50 rounded-lg">
                  <span className="w-24 text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded text-center">
                    {p.label}
                  </span>
                  <p className="text-zinc-400 text-sm">{p.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Integrações */}
        <div>
          <h2 className="text-white font-semibold text-base mb-4">Integrações</h2>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-4 max-w-2xl">
            <p className="text-zinc-400 text-sm">
              Preencha o arquivo <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-emerald-400 text-xs">.env.local</code> na raiz do projeto com as chaves de cada integração abaixo. Após preencher, reinicie o servidor.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {integracoes.map((integ) => {
              const cfg = statusConfig[integ.status]
              const Icon = cfg.icon
              return (
                <div key={integ.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="text-white font-semibold">{integ.name}</h4>
                      <p className="text-zinc-500 text-xs mt-0.5">{integ.desc}</p>
                    </div>
                    <span className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${cfg.bg} ${cfg.color}`}>
                      <Icon className="w-3 h-3" />
                      {cfg.label}
                    </span>
                  </div>
                  <div className="space-y-1.5 mb-4">
                    <p className="text-zinc-600 text-xs uppercase tracking-wider font-medium">Variáveis necessárias</p>
                    {integ.envVars.map((v) => (
                      <code key={v} className="block text-xs bg-zinc-800 text-zinc-300 px-2 py-1 rounded">
                        {v}
                      </code>
                    ))}
                  </div>
                  <a
                    href={integ.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Ver documentação da API
                  </a>
                </div>
              )
            })}
          </div>
        </div>

        {/* Sincronização */}
        <div className="max-w-2xl">
          <h2 className="text-white font-semibold text-base mb-4">Sincronização de Dados</h2>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <p className="text-zinc-500 text-sm mb-4">
              Os dados são buscados ao vivo sempre que você abre uma página — sem atraso de cache.
            </p>
            <div className="space-y-3">
              {[
                { label: 'Yampi (pedidos)', freq: 'Tempo real ao carregar' },
                { label: 'CLINT CRM', freq: 'Tempo real ao carregar' },
                { label: 'Meta Ads', freq: 'Pendente integração' },
                { label: 'Google Ads', freq: 'Pendente integração' },
                { label: 'GA4', freq: 'Pendente integração' },
                { label: 'Shopee', freq: 'Pendente integração' },
                { label: 'Amazon', freq: 'Pendente integração' },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                  <span className="text-zinc-300 text-sm">{item.label}</span>
                  <span className={`text-xs ${item.freq.startsWith('Tempo') ? 'text-emerald-400' : 'text-zinc-600'}`}>
                    {item.freq}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
