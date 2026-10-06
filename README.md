# Character Population Generator

A client-side population generator for exploring independent personality and functionality traits.

## Features

- Generates up to 1,000 characters with unique IDs.
- Scores 30 personality facets and 6 functionality variables from 0 to 10.
- Uses configurable six-block probability distributions.
- Visualizes personality and functionality averages in a scatter plot.
- Opens complete character profiles from plotted points.
- Imports and exports populations as CSV files.
- Selects a Brazilian Portuguese name, age range, occupation, hobby, sexual orientation, physical health, hereditary psychopathology tendency, communication style, communication region, and reason for first visit to the psychologist for every character.
- Provides default score-distribution probabilities plus adjustable probabilities for every categorical trait.
- Loads trait names and descriptions from the JSON datasets in `data/`.
- Generates a set of biographical stories for a character via the Gemini API, from an icon next to the character ID in its profile.

## Character stories (Gemini)

Click the sparkles icon next to a character's ID (in its profile modal) to generate
~10-14 short biographical story beats for that character with Gemini, spanning
childhood, relationships, everyday life, the reason they sought a first consultation,
and more guarded material tied to their hereditary psychopathology tendency.

This requires a Gemini API key, pasted into the settings modal (gear icon in the
page header). The key is saved only in the browser's `localStorage` and is never
written to any file in this repository — it is not safe to share this build
publicly with your own key saved in it, since the browser calls the Gemini API
directly with that key. Get a free key at
[Google AI Studio](https://aistudio.google.com/apikey).

## Patient chat

Once a character has stories, the speech-bubble icon next to its ID opens a
separate tab (`chat.html`) where you play the psychologist and the character
plays the patient, powered by Gemini.

- The chat tab is isolated: it receives only the selected patient's data, handed
  over through a one-off `chatSession:<id>` entry in `localStorage`.
- The side panel shows the patient's **anamnese** — intake-level information
  only. Personality scores, functionality scores and the generated stories stay
  hidden, since uncovering them through the conversation is the point.
- Each click of the chat icon starts a brand new, independent conversation.
  Within a conversation the full history is resent on every turn, so the patient
  remembers everything said in that session (and survives a page reload).
- The patient stays in character, speaking in a way consistent with its
  communication style, personality and functionality scores, and only opens up
  about guarded material once trust is built.
- Most characters speak region-neutral Brazilian Portuguese, but some carry a
  regional colouring (one of Brazil's five regions) that subtly shapes their
  vocabulary and expressions. It is deliberately kept out of the anamnese, so it
  is something you notice from how they talk rather than read off the chart.

## Run locally

Serve the folder with any local static file server, then open `index.html` in a browser. For example:

```text
python -m http.server
```

Open `http://localhost:8000`.

The JSON files are loaded by the browser at runtime, so a local HTTP server is recommended instead of opening the HTML file directly.

## Project files

- `index.html` - application markup
- `style.css` - interface styling (shared by both pages)
- `app.js` - population generation and visualization logic
- `chat.html` / `chat.js` - the isolated patient chat tab
- `gemini.js` - shared Gemini client (API key storage, model fallback)
- `prompts/storyPrompt.js` - story-generation prompt, taxonomy and response schema
- `prompts/chatPrompt.js` - patient persona/system prompt for the chat
- `data/personality.json` - Big Five dimensions and facet metadata
- `data/functionality.json` - functionality variable metadata
- `data/names.json` - male and female name components that expand to 1,000 unique full names per gender
- `data/occupation.json` - age-range occupation pools
- `data/hobby.json` - 250 hobby options
- `data/sexualOrientation.json` - sexual orientation options
- `data/physicalHealth.json` - physical health options
- `data/hereditaryPsychopathologyTendencies.json` - hereditary tendency options, including none
- `data/communicationStyle.json` - communication style options
- `data/communicationRegion.json` - regional speech colouring (mostly neutral)
- `data/reasonForFirstVisit.json` - reasons for a first visit to the psychologist
- `data/categoricalProbabilities.json` - default percentage probabilities for categorical traits

Categorical trait controls use direct percentages. Each trait is normalized to exactly 100%; changing one option proportionally adjusts the remaining options. Hobbies default to an even distribution, while occupations default to an even distribution within the selected age range.