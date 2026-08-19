# Schreifall

A small static site for finding Magic: The Gathering cards for EDH/Commander deckbuilding, without hand-writing [Scryfall search syntax](https://scryfall.com/docs/syntax).

Pick a color identity and a text/tag to search for, and it builds the Scryfall query for you (e.g. selecting Black + Red and searching "treasure" produces `id<=BR o:treasure legal:commander -type:basic`), then fetches and displays matching cards directly from the [Scryfall API](https://scryfall.com/docs/api).

No build step, no backend — plain HTML/CSS/JS, calling `api.scryfall.com` straight from the browser.

Also supports:
- Card type, mana value, and max price filters, plus sorting (defaults to EDHREC rank)
- Comma-separated text terms matched as OR (e.g. `treasure, food`)
- Every search encodes into the URL — "Copy link to this search" gives a bookmarkable/shareable link
- Saved searches, stored locally in the browser (no account/server needed)
- "Copy card names" to export the current results as a deckbuilder-importable list

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

- Rarity filter
- Switch GitHub Pages deployment to a GitHub Actions workflow
