import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAnamneseAvatar } from '@/lib/anamnese/narrativas'
import { getAnamneseAvatarPublico } from '@/lib/anamnese/avataresPublicos'
import { buildAvatarVoicePrompt, AVATAR_ABERTURA_TRIGGER } from '@/lib/anamnese/prompts'

/**
 * GET /api/anamnese/voz-prompt?avatar_id=<id>
 *
 * Entrega ao cliente a CONFIG do modo Voz (Gemini Live) de um avatar:
 *   - systemPrompt     → persona unificada (manifesto + papel), com prefixo [MODO VOZ]
 *   - voiceName        → voz Gemini do avatar
 *   - aberturaTrigger  → trigger p/ o avatar se apresentar em voz (cliente vulnerável, sem conduzir)
 *
 * INVARIANTE DE SEGURANÇA: o prompt é construído AQUI (server-side) via getAnamneseAvatar.
 * narrativas.ts (com os nós latentes) NUNCA é importado no cliente — daqui só sai a
 * persona MANIFESTA. Os nós latentes ficam exclusivamente no Supervisor (server-side).
 */
export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const avatarId = new URL(req.url).searchParams.get('avatar_id') ?? ''
  const avatar = getAnamneseAvatar(avatarId)
  const pub = getAnamneseAvatarPublico(avatarId)
  if (!avatar || !pub) return NextResponse.json({ error: 'Avatar não encontrado' }, { status: 404 })

  return NextResponse.json({
    systemPrompt: buildAvatarVoicePrompt(avatar),
    voiceName: pub.voz,
    aberturaTrigger: AVATAR_ABERTURA_TRIGGER,
  })
}
