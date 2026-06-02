/**
 * TI Retiros — character definitions (client-safe).
 *
 * System prompts and voice details live server-side in server.js.
 * This file only exports the public metadata needed by the UI.
 */

export interface CharacterConfig {
  id: string
  name: string
  /** Gemini Live prebuilt voice name (resolved server-side from characterId) */
  voiceName: 'Kore' | 'Charon' | 'Aoede' | 'Puck' | 'Fenrir' | 'Leda'
  description: string
  /** Short label for UI display */
  label: string
}

export const RETIROS_CHARACTERS: CharacterConfig[] = [
  {
    id: 'facilitador',
    name: 'Facilitadora',
    voiceName: 'Aoede',
    description: 'Guia do retiro transpessoal — presença serena, perguntas abertas',
    label: '🌿 Facilitadora',
  },
  {
    id: 'companheiro',
    name: 'Companheiro de Jornada',
    voiceName: 'Leda',
    description: 'Participante em processo — partilha genuína, curiosidade solidária',
    label: '🔥 Companheiro',
  },
]

export function getCharacter(id: string): CharacterConfig | undefined {
  return RETIROS_CHARACTERS.find(c => c.id === id)
}
