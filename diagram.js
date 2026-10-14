// Cognitive Conceptualization Diagram (Judith Beck form) - data and form builder.
// No globals; form is built into a passed container.

export const DIAGRAM_FIELDS = [
  {
    group: 'Dados relevantes da infância',
    fields: [{ id: 'infancia', label: 'Dados relevantes da infância' }]
  },
  {
    group: 'Crença(s) central(is)',
    fields: [{ id: 'crencas', label: 'Crença(s) central(is)' }]
  },
  {
    group: 'Pressupostos / regras / atitudes condicionais',
    fields: [{ id: 'pressupostos', label: 'Pressupostos / regras / atitudes condicionais' }]
  },
  {
    group: 'Estratégia(s) compensatória(s)',
    fields: [{ id: 'estrategias', label: 'Estratégia(s) compensatória(s)' }]
  },
  {
    group: 'Situação 1',
    fields: [
      { id: 's1-situacao', label: 'Situação' },
      { id: 's1-pensamento', label: 'Pensamento automático' },
      { id: 's1-significado', label: 'Significado do pensamento automático' },
      { id: 's1-emocao', label: 'Emoção' },
      { id: 's1-comportamento', label: 'Comportamento' }
    ]
  },
  {
    group: 'Situação 2',
    fields: [
      { id: 's2-situacao', label: 'Situação' },
      { id: 's2-pensamento', label: 'Pensamento automático' },
      { id: 's2-significado', label: 'Significado do pensamento automático' },
      { id: 's2-emocao', label: 'Emoção' },
      { id: 's2-comportamento', label: 'Comportamento' }
    ]
  },
  {
    group: 'Situação 3',
    fields: [
      { id: 's3-situacao', label: 'Situação' },
      { id: 's3-pensamento', label: 'Pensamento automático' },
      { id: 's3-significado', label: 'Significado do pensamento automático' },
      { id: 's3-emocao', label: 'Emoção' },
      { id: 's3-comportamento', label: 'Comportamento' }
    ]
  }
];

export function buildDiagramForm(form, values = {}, onChange = null){
  form.innerHTML = '';
  DIAGRAM_FIELDS.forEach(({ group, fields }) => {
    const groupHeading = document.createElement('h3');
    groupHeading.className = 'diagram-group-heading';
    groupHeading.textContent = group;
    form.appendChild(groupHeading);

    fields.forEach(({ id, label }) => {
      const labelEl = document.createElement('label');
      labelEl.htmlFor = id;
      labelEl.textContent = label;

      const textarea = document.createElement('textarea');
      textarea.id = id;
      textarea.className = 'diagram-textarea';
      textarea.rows = 3;
      textarea.value = values[id] || '';

      if(onChange){
        textarea.addEventListener('input', (ev) => onChange(id, ev.target.value));
      }

      form.appendChild(labelEl);
      form.appendChild(textarea);
    });
  });
}
