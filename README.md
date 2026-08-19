# Schreifall

A small static site for finding Magic: The Gathering cards for EDH/Commander deckbuilding, without hand-writing [Scryfall search syntax](https://scryfall.com/docs/syntax).

Pick a color identity and a text/tag to search for, and it builds the Scryfall query for you (e.g. selecting Black + Red and searching "treasure" produces `id<=BR o:treasure legal:commander -type:basic`), then fetches and displays matching cards directly from the [Scryfall API](https://scryfall.com/docs/api).

No build step, no backend — plain HTML/CSS/JS, calling `api.scryfall.com` straight from the browser.

## Running locally

Any static file server works, e.g.:

```bash
npx serve .
```

Then open the printed local URL.

## Deploying to GitHub Pages

1. Push this repo to GitHub.
2. In the repo settings, under **Pages**, set the source to the `main` branch, root folder.
3. The site will be published at `https://<username>.github.io/<repo>/`.

## Roadmap

- Sorting/filtering of results (by CMC, price, etc.)
- More filter options (card type, rarity)
