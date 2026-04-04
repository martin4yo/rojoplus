/**
 * Mapeo de tiers a modelos reales por proveedor.
 * Cuando un proveedor discontinúa un modelo, se actualiza aquí
 * y todos los tenants con ese tier migran automáticamente.
 */

export const AI_MODEL_MAP = {
  anthropic: {
    rapido:   'claude-haiku-4-5-20251001',
    estandar: 'claude-sonnet-4-6',
    premium:  'claude-opus-4-6',
  },
  openai: {
    rapido:   'gpt-4o-mini',
    estandar: 'gpt-4o',
    premium:  'gpt-4o',
  },
}

export const AI_TIER_LABELS = {
  rapido:   { label: 'Rápido',    desc: 'Haiku / GPT-4o mini · ~$0.001 por mensaje' },
  estandar: { label: 'Estándar',  desc: 'Sonnet / GPT-4o · ~$0.012 por mensaje' },
  premium:  { label: 'Premium',   desc: 'Opus / GPT-4o · ~$0.06 por mensaje' },
}

export const AI_PROVIDER_LABELS = {
  anthropic: 'Anthropic (Claude)',
  openai:    'OpenAI (GPT)',
}

/**
 * Resuelve el modelo real a usar.
 * Si el tenant tiene un override explícito, lo usa.
 * Si no, usa el tier mapeado al proveedor.
 * Si el proveedor no es conocido, cae a Anthropic Haiku.
 */
export function resolverModelo(provider, tier, override) {
  if (override) return override
  const map = AI_MODEL_MAP[provider] || AI_MODEL_MAP.anthropic
  return map[tier] || map.rapido
}
