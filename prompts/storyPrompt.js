// Prompt used to generate a character's biographical stories via Gemini.
// Kept isolated from app.js so the prompt text/categories can be reviewed and
// edited without touching application logic.

export const STORY_CATEGORIES = ['infancia', 'relacionamentos', 'cotidiano', 'motivo_consulta', 'nucleo_oculto'];
export const DISCLOSURE_LEVELS = ['facil', 'moderado', 'reservado'];

// Gemini responseSchema (generationConfig.responseSchema) constraining the
// structured JSON output for story generation.
export const STORIES_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    stories: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          category: { type: 'STRING', enum: STORY_CATEGORIES },
          disclosure: { type: 'STRING', enum: DISCLOSURE_LEVELS },
          summary: { type: 'STRING' },
          relatedTrait: { type: 'STRING' }
        },
        required: ['title', 'category', 'disclosure', 'summary']
      }
    }
  },
  required: ['stories']
};

export function buildStoriesPrompt(ch, personalitySummary, functionalSummary){
  return `Você é um gerador de histórias para uma ferramenta de treinamento de psicólogos. Gere material biográfico plausível e internamente consistente para o personagem fictício abaixo, que será usado por um estudante para treinar entrevistas clínicas.

Perfil do personagem:
- Nome: ${ch.name}
- Gênero: ${ch.gender}
- Faixa etária: ${ch.ageRange}
- Ocupação: ${ch.occupation}
- Hobby: ${ch.hobby}
- Orientação sexual: ${ch.sexualOrientation}
- Saúde física: ${ch.physicalHealth}
- Tendência de psicopatologia hereditária: ${ch.hereditaryPsychopathologyTendencies}
- Estilo de comunicação: ${ch.communicationStyle}
- Motivo da primeira consulta: ${ch.reasonForFirstVisit}
- Médias de personalidade por domínio (escala 0-10, Big Five): ${personalitySummary}
- Funcionalidade por área (escala 0-10): ${functionalSummary}

Gere exatamente estas histórias, como fragmentos narrativos que o personagem poderia contar em primeira pessoa durante uma consulta:
- 2 histórias de categoria "infancia" (contexto familiar/formativo)
- 2 a 3 histórias de categoria "relacionamentos" (amizades, família atual, relacionamento amoroso)
- 2 a 3 histórias de categoria "cotidiano" (triviais, ligadas ao hobby/ocupação, sem relação direta com qualquer diagnóstico - servem para criar rapport)
- 1 a 2 histórias de categoria "motivo_consulta" (o incidente/gatilho concreto que levou o personagem a esta consulta, coerente com "${ch.reasonForFirstVisit}")
- 2 histórias de categoria "nucleo_oculto" (material mais reservado, coerente com a tendência de psicopatologia hereditária informada; se a tendência for "Nenhuma", baseie-se em dificuldades psicológicas comuns e coerentes com os traços de personalidade/funcionalidade informados, sem inventar um transtorno)

Para cada história, defina "disclosure" como "facil" (o personagem comentaria isso espontaneamente), "moderado" (precisa de alguma empatia/pergunta direta) ou "reservado" (só revelaria com confiança construída). Histórias "nucleo_oculto" devem normalmente ser "reservado" ou "moderado", nunca "facil". Escreva os resumos em português do Brasil, em 2 a 4 frases, em tom narrativo e específico (evite clichês genéricos). Preencha "relatedTrait" com o traço relacionado (ex.: nome da tendência, ou sigla/nome da variável funcional ou domínio de personalidade) ou deixe em branco quando não houver relação direta (comum em "cotidiano").`;
}
