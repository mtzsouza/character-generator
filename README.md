# Character Population Generator

A client-side population generator for exploring independent personality and functionality traits.

## Features

- Generates up to 1,000 characters with unique IDs.
- Scores 30 personality facets and 6 functionality variables from 0 to 10.
- Uses configurable six-block probability distributions.
- Visualizes personality and functionality averages in a scatter plot.
- Opens complete character profiles from plotted points.
- Imports and exports populations as CSV files.
- Selects a Brazilian Portuguese name, age range, occupation, hobby, sexual orientation, physical health, and hereditary psychopathology tendency for every character.
- Provides default score-distribution probabilities plus adjustable probabilities for every categorical trait.
- Loads trait names and descriptions from the JSON datasets in `data/`.

## Run locally

Serve the folder with any local static file server, then open `index.html` in a browser. For example:

```text
python -m http.server
```

Open `http://localhost:8000`.

The JSON files are loaded by the browser at runtime, so a local HTTP server is recommended instead of opening the HTML file directly.

## Project files

- `index.html` - application markup
- `style.css` - interface styling
- `app.js` - population generation and visualization logic
- `data/personality.json` - Big Five dimensions and facet metadata
- `data/functionality.json` - functionality variable metadata
- `data/names.json` - male and female name components that expand to 1,000 unique full names per gender
- `data/occupation.json` - age-range occupation pools
- `data/hobby.json` - 250 hobby options
- `data/sexualOrientation.json` - sexual orientation options
- `data/physicalHealth.json` - physical health options
- `data/hereditaryPsychopathologyTendencies.json` - hereditary tendency options, including none
- `data/categoricalProbabilities.json` - default percentage probabilities for categorical traits

Categorical trait controls use direct percentages. Each trait is normalized to exactly 100%; changing one option proportionally adjusts the remaining options. Hobbies default to an even distribution, while occupations default to an even distribution within the selected age range.