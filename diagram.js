// Cognitive Conceptualization Diagram (Judith Beck form) - data and form builder.
// No globals; form is built into a passed container.

export const DIAGRAM_FIELDS = [
  {
    group: 'Dados da infância',
    fields: [{ id: 'infancia', label: 'Dados da infância' }]
  },
  {
    group: 'Crenças centrais',
    fields: [{ id: 'crencas', label: 'Crenças centrais' }]
  },
  {
    group: 'Pressupostos e regras condicionais',
    fields: [{ id: 'pressupostos', label: 'Pressupostos e regras condicionais' }]
  },
  {
    group: 'Estratégias compensatórias',
    fields: [{ id: 'estrategias', label: 'Estratégias compensatórias' }]
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
      // Only add field label if it differs from the group heading
      if(label !== group){
        const fieldLabel = document.createElement('span');
        fieldLabel.className = 'diagram-field-label';
        fieldLabel.textContent = label;
        form.appendChild(fieldLabel);
      }

      const textarea = document.createElement('textarea');
      textarea.id = id;
      textarea.className = 'diagram-textarea';
      textarea.rows = 3;
      textarea.value = values[id] || '';

      if(onChange){
        textarea.addEventListener('input', (ev) => onChange(id, ev.target.value));
      }

      form.appendChild(textarea);
    });
  });
}
