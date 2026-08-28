# Schreifall

A small static site for finding Magic: The Gathering cards for EDH/Commander deckbuilding, without hand-writing [Scryfall search syntax](https://scryfall.com/docs/syntax).

Pick a color identity and fill in any of four text fields (card name, oracle tag, type, oracle text), and it builds the Scryfall query for you (e.g. selecting Red, typing "dwarf" in Type, and "treasure" in Oracle text produces `id<=R t:dwarf o:treasure legal:commander -type:basic`), then fetches and displays matching cards directly from the [Scryfall API](https://scryfall.com/docs/api).

No build step, no backend — plain HTML/CSS/JS, calling `api.scryfall.com` straight from the browser.

Also supports:
- Card type, mana value, power/toughness, max price (EUR), Legendary (any/only/exclude), and "exclude lands that enter tapped" (`-otag:tapland`) filters, plus sorting (defaults to EDHREC rank)
- Every text field, and every comma-separated term within a field, is ANDed together — filled-in fields all have to match, narrowing results (e.g. Type `dwarf` + Oracle text `treasure` finds only Dwarf cards that also mention treasure)
- Every search encodes into the URL — "Copy link to this search" gives a bookmarkable/shareable link
- Saved searches, stored locally in the browser (no account/server needed)
- "Copy card names" to export the current results as a deckbuilder-importable list
- Result grid captions show each card's price (EUR, falling back to USD) instead of duplicating the mana cost/type line already visible on the card art
- Click any card for a detail view (big image, oracle text, price), with a flip toggle for double-faced/transform cards, and a "Similar cards" section — other cards sharing its creature subtype (tribal, e.g. other Dwarves) and/or a keyword ability (e.g. Trample, Ward), within the same color identity; falls back to core type when a card has neither. Sorted by EDHREC rank *descending* to surface lesser-known cards instead of the same staples every time. Deep-linkable via URL, with links out to that card's Scryfall Tagger page, its official Wizards Gatherer page (rulings, etc.), and Cardmarket

## Notes

Scryfall's community tags (e.g. `otag:sacrifice-outlet`) live on a separate service, [Scryfall Tagger](https://tagger.scryfall.com), which isn't part of the public REST API and blocks cross-origin requests — so this site can't fetch a card's tags directly. Tag-based *searching* still works via `otag:` in the Text/tag search field (Scryfall resolves that server-side); the detail view just links out to the card's Tagger page instead of showing tags inline.

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
