import Link from 'next/link'

export default function PrivacidadePage() {
  return (
    <div className="max-w-2xl space-y-8 animate-fade-in">
      <div>
        <nav className="text-xs mb-3" style={{ color: 'var(--muted-foreground)' }}>
          <Link href="/" className="hover:underline">Início</Link>
          <span className="mx-1.5">›</span>
          <span>Privacidade</span>
        </nav>
        <h1
          className="text-2xl font-medium"
          style={{ fontFamily: 'var(--font-lora)', color: 'var(--primary)' }}
        >
          Privacidade e os teus sonhos
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
          O que acontece com o que partilhas nesta plataforma.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-base font-medium" style={{ color: 'var(--foreground)' }}>
          Os teus sonhos são teus
        </h2>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
          Os sonhos que registas no diário são privados por definição. Nenhum outro utilizador os vê.
          Não são partilhados com a Transpersonal International, nem utilizados para treinar modelos de
          linguagem. Ficam guardados na base de dados associados exclusivamente à tua conta.
        </p>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
          Podes exportar ou eliminar os teus dados a qualquer momento nas{' '}
          <Link href="/configuracoes" className="underline underline-offset-2">configurações</Link>.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-medium" style={{ color: 'var(--foreground)' }}>
          As sessões de supervisão
        </h2>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
          As mensagens que escreves nas sessões com o Supervisor são enviadas para a API da Anthropic
          para gerar as respostas. A Anthropic aplica a sua política de privacidade a esses dados —
          por omissão, não os utiliza para treino de modelos. Podes consultar a política em{' '}
          <a
            href="https://www.anthropic.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
          >
            anthropic.com/privacy
          </a>
          .
        </p>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
          O histórico de cada sessão fica guardado na tua conta e é acessível apenas por ti. O mesmo
          se aplica às sessões com os avatares de prática.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-medium" style={{ color: 'var(--foreground)' }}>
          Os teus dados
        </h2>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
          A plataforma guarda o teu nome, endereço de correio electrónico e o progresso de leitura
          no manual. Não guardamos dados de pagamento — os pagamentos são processados directamente
          pela Transpersonal International fora desta plataforma.
        </p>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
          Tens o direito de aceder, corrigir ou eliminar os teus dados. Para qualquer questão,
          contacta{' '}
          <a
            href="mailto:support@transpersonalinternational.com"
            className="underline underline-offset-2"
          >
            support@transpersonalinternational.com
          </a>
          .
        </p>
      </section>

      <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
        Última revisão: Maio de 2026
      </p>
    </div>
  )
}
