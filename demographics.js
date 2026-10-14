// Pure demographic sampling functions: age, education, SES, and occupation filtering.
// No DOM or fetch; can be tested in Node. Data is passed in, so tables can be swapped.

export function pickAge(ageRange, ageBounds){
  if(!ageBounds || !ageBounds[ageRange]) return null;
  const { min, max } = ageBounds[ageRange];
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Weighted random pick: values array, probabilities object keyed by value.
export function pickWeighted(values, probabilities){
  const weightedValues = values.map(value => ({value, weight: Math.max(0, probabilities[value] || 0)}));
  const total = weightedValues.reduce((sum, item) => sum + item.weight, 0);
  if(total <= 0) return values[Math.floor(Math.random() * values.length)];
  let cursor = Math.random() * total;
  for(const item of weightedValues){
    cursor -= item.weight;
    if(cursor <= 0) return item.value;
  }
  return weightedValues[weightedValues.length - 1].value;
}

export function pickEducation(ageRange, educationTables){
  if(!educationTables || !educationTables.levels) return null;
  const { levels, byAgeRange } = educationTables;
  const probs = byAgeRange[ageRange] || {};
  return pickWeighted(levels, probs);
}

export function pickSocioeconomic(education, sesTables){
  if(!sesTables || !sesTables.classes) return null;
  const { classes, byEducation } = sesTables;
  const probs = byEducation[education] || {};
  return pickWeighted(classes, probs);
}

// Filter occupations by education tier, apply weights.
// occupations: array of occupation names
// education: 'Fundamental', 'Médio', 'Superior'
// occupationTiers: { name: 'fundamental' | 'medio' | 'superior' }
// baseWeights: { name: numeric weight } (from categorical probabilities)
export function occupationWeights(occupations, education, occupationTiers, baseWeights = {}){
  const tierOrder = { fundamental: 0, medio: 1, superior: 2 };
  const educationTier = tierOrder[education.toLowerCase()] ?? 2;
  const weights = {};

  occupations.forEach(occ => {
    const tierStr = occupationTiers[occ];
    const occTier = tierOrder[tierStr] ?? 0;
    const baseWeight = baseWeights[occ] || 1;

    // Occupation is allowed if its tier <= education tier
    if(occTier <= educationTier){
      // Weight x1.0 for exact match, x0.1 for underemployment
      const multiplier = occTier === educationTier ? 1.0 : 0.1;
      weights[occ] = baseWeight * multiplier;
    } else {
      // Not allowed
      weights[occ] = 0;
    }
  });

  return weights;
}
