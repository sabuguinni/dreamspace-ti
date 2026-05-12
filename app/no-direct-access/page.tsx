/**
 * Página de acesso negado — DreamSpace TI
 *
 * Exibida quando alguém tenta aceder directamente à plataforma Dreams
 * sem passar pelo SSO do LMS Transpersonal International.
 */
export default function NoDirectAccessPage() {
  return (
    <main
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "var(--background)" }}
    >
      <div className="w-full max-w-md text-center space-y-6">
        {/* Ícone */}
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto"
          style={{ background: "rgba(102,51,153,0.12)", border: "1px solid rgba(102,51,153,0.2)" }}
        >
          <svg
            viewBox="0 0 24 24"
            className="w-10 h-10"
            style={{ color: "var(--accent)" }}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z"
            />
          </svg>
        </div>

        {/* Título */}
        <div className="space-y-1">
          <p
            className="text-xs font-medium tracking-widest uppercase"
            style={{ color: "var(--accent)", fontFamily: "var(--font-inter)" }}
          >
            Transpersonal International
          </p>
          <h1
            className="text-2xl font-medium"
            style={{ fontFamily: "var(--font-lora)", color: "var(--primary)" }}
          >
            DreamSpace TI
          </h1>
        </div>

        {/* Mensagem */}
        <div
          className="rounded-xl border p-6 space-y-3"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
        >
          <p className="font-medium" style={{ color: "var(--foreground)" }}>
            Acesso exclusivo via plataforma de formação
          </p>
          <p className="text-sm leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
            O DreamSpace TI é acessível apenas através dos cursos da{" "}
            <strong style={{ color: "var(--foreground)" }}>Transpersonal International</strong>.
          </p>
          <p className="text-sm leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
            Se és aluno, acede à plataforma LMS, abre o teu curso e clica em{" "}
            <strong style={{ color: "var(--foreground)" }}>Abrir DreamSpace</strong> na aula
            correspondente.
          </p>
        </div>

        {/* Link para LMS */}
        <a
          href="https://app.transpersonalinternational.com"
          className="inline-flex items-center gap-2 text-sm font-medium transition-colors"
          style={{ color: "var(--accent)" }}
        >
          Ir para a plataforma de formação →
        </a>
      </div>
    </main>
  );
}
