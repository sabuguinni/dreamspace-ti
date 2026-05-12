/**
 * Dreams SSO — Endpoint de autenticação via token JWT do LMS
 *
 * GET /api/auth/lms-sso?token=JWT_TOKEN
 *
 * Fluxo:
 * 1. Valida o JWT assinado pelo LMS com JWT_DREAMS_SECRET
 * 2. Cria ou obtém utilizador Supabase pelo email
 * 3. Gera OTP de sessão via admin API e verifica imediatamente
 * 4. Redireciona para / com sessão Supabase activa nos cookies
 */
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { createServerClient } from "@supabase/ssr";

const DREAMS_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://dreams.transpersonalinternational.com";

// Página HTML de erro inline (sem depender de rotas Next.js)
function errorHtml(message: string, statusCode = 401): Response {
  const html = `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DreamSpace — Sessão</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0f0a1e;
      color: #e5e5e5;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
    }
    .card {
      max-width: 420px;
      text-align: center;
      background: rgba(102,51,153,0.08);
      border: 1px solid rgba(102,51,153,0.25);
      border-radius: 16px;
      padding: 2.5rem 2rem;
    }
    .icon { font-size: 2.5rem; margin-bottom: 1rem; }
    h2 { color: #a855f7; font-size: 1.25rem; margin-bottom: 0.75rem; }
    p { color: #9ca3af; line-height: 1.6; font-size: 0.9rem; }
    .back { margin-top: 1.5rem; }
    .back a {
      color: #a855f7;
      text-decoration: none;
      font-size: 0.85rem;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">🌙</div>
    <h2>DreamSpace TI</h2>
    <p>${message}</p>
    <div class="back">
      <a href="javascript:history.back()">← Voltar ao curso</a>
    </div>
  </div>
</body>
</html>`;

  return new Response(html, {
    status: statusCode,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  // Sem token → redirecionar para página de acesso negado
  if (!token) {
    return NextResponse.redirect(new URL("/no-direct-access", DREAMS_URL));
  }

  const secret = process.env.JWT_DREAMS_SECRET;
  if (!secret) {
    console.error("[Dreams SSO] JWT_DREAMS_SECRET não configurada");
    return errorHtml("Serviço temporariamente indisponível. Tenta novamente mais tarde.", 503);
  }

  // ── 1. Validar JWT ────────────────────────────────────────────────
  let payload: {
    sub: string;
    email: string;
    name?: string;
    courseId: number;
    lmsUserId: number;
    exp: number;
  };

  try {
    const { payload: p } = await jwtVerify(
      token,
      new TextEncoder().encode(secret)
    );
    payload = p as typeof payload;
  } catch {
    return errorHtml(
      "A tua sessão expirou ou o link é inválido.<br>Volta ao teu curso e clica novamente em <strong>Abrir DreamSpace</strong>.",
      401
    );
  }

  const { email, name } = payload;
  if (!email) {
    return errorHtml("Token inválido. Volta ao teu curso e tenta novamente.", 400);
  }

  // ── 2. Preparar resposta de redirect com cookies ──────────────────
  const redirectTo = new URL("/", DREAMS_URL);
  const response = NextResponse.redirect(redirectTo);

  // ── 3. Criar Supabase service client (admin) ──────────────────────
  const serviceClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    // Service client não precisa de gerir cookies da sessão
    { cookies: { getAll: () => [], setAll: () => {} } }
  );

  // ── 4. Gerar OTP via admin (cria user se não existe) ─────────────
  const { data: linkData, error: linkError } =
    await serviceClient.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: {
        data: {
          name: name || email,
          lms_user: true,
          lms_source: "sso",
        },
      },
    });

  if (linkError || !linkData?.properties?.email_otp) {
    console.error("[Dreams SSO] generateLink falhou:", linkError?.message);
    return errorHtml(
      "Não foi possível criar a sessão de acesso. Tenta novamente.",
      500
    );
  }

  // ── 5. Verificar OTP imediatamente — cria sessão Supabase ─────────
  // Usar o client anon com callback de cookies para escrever na response
  const anonClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name: cookieName, value, options }) => {
            response.cookies.set(cookieName, value, {
              ...options,
              // Garantir que os cookies funcionam em contexto iframe (same-site)
              sameSite: "lax",
              secure: true,
            });
          });
        },
      },
    }
  );

  const {
    data: { session },
    error: verifyError,
  } = await anonClient.auth.verifyOtp({
    email,
    token: linkData.properties.email_otp,
    type: "email",
  });

  if (verifyError || !session) {
    console.error("[Dreams SSO] verifyOtp falhou:", verifyError?.message);
    return errorHtml(
      "Não foi possível autenticar. Fecha o DreamSpace, volta ao curso e tenta novamente.",
      401
    );
  }

  console.log(
    `[Dreams SSO] Sessão criada para ${email} (userId=${payload.lmsUserId}, courseId=${payload.courseId})`
  );

  return response;
}
