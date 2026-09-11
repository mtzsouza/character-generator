# Character Population Generator

A client-side population generator for exploring independent personality and functionality traits.

## Features

- Generates up to 1,000 characters with unique IDs.
- Scores 30 personality facets and 6 functionality variables from 0 to 10.
- Uses configurable six-block probability distributions.
- Visualizes personality and functionality averages in a scatter plot.
- Opens complete character profiles from plotted points.
- Imports and exports populations as CSV files.
- Loads trait names and descriptions from `personality.json` and `functionality.json`.

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
- `personality.json` - Big Five dimensions and facet metadata
- `functionality.json` - functionality variable metadata