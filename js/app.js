const COLOR_ORDER = ["W", "U", "B", "R", "G"];

const form = document.getElementById("search-form");
const exactIdentityBox = document.getElementById("exact-identity");
const textModeSelect = document.getElementById("text-mode");
const textQueryInput = document.getElementById("text-query");
const commanderLegalBox = document.getElementById("commander-legal");
const excludeBasicsBox = document.getElementById("exclude-basics");
const queryPreview = document.getElementById("query-preview-text");
const scryfallLink = document.getElementById("scryfall-link");
const resultsStatus = document.getElementById("results-status");
const resultsGrid = document.getElementById("results-grid");
const loadMoreBtn = document.getElementById("load-more");

let nextPageUrl = null;

function getSelectedColors() {
  const checked = Array.from(form.querySelectorAll('input[name="color"]:checked')).map(el => el.value);
  return COLOR_ORDER.filter(c => checked.includes(c));
}

function quoteIfNeeded(value) {
  return /\s/.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value;
}

function buildQuery() {
  const parts = [];

  const colors = getSelectedColors();
  if (colors.length > 0) {
    const op = exactIdentityBox.checked ? "=" : "<=";
    parts.push(`id${op}${colors.join("")}`);
  }

  const text = textQueryInput.value.trim();
  if (text) {
    const mode = textModeSelect.value;
    if (mode === "o") parts.push(`o:${quoteIfNeeded(text)}`);
    else if (mode === "otag") parts.push(`otag:${text.replace(/\s+/g, "-")}`);
    else if (mode === "name") parts.push(`name:${quoteIfNeeded(text)}`);
  }

  if (commanderLegalBox.checked) parts.push("legal:commander");
  if (excludeBasicsBox.checked) parts.push("-type:basic");

  return parts.join(" ").trim();
}

function updateQueryPreview() {
  const query = buildQuery();
  queryPreview.textContent = query || "(no filters set — will match every card)";
  scryfallLink.href = query
    ? `https://scryfall.com/search?q=${encodeURIComponent(query)}`
    : "https://scryfall.com/search";
}

function cardImageUrl(card) {
  if (card.image_uris) return card.image_uris.normal;
  if (card.card_faces && card.card_faces[0].image_uris) return card.card_faces[0].image_uris.normal;
  return null;
}

function renderCards(cards) {
  for (const card of cards) {
    const item = document.createElement("div");
    item.className = "card-item";

    const link = document.createElement("a");
    link.href = card.scryfall_uri;
    link.target = "_blank";
    link.rel = "noopener";

    const imgUrl = cardImageUrl(card);
    if (imgUrl) {
      const img = document.createElement("img");
      img.src = imgUrl;
      img.alt = card.name;
      img.loading = "lazy";
      link.appendChild(img);
    }

    const name = document.createElement("span");
    name.className = "card-name";
    name.textContent = card.name;
    link.appendChild(name);

    item.appendChild(link);
    resultsGrid.appendChild(item);
  }
}

async function fetchPage(url) {
  loadMoreBtn.hidden = true;
  resultsStatus.textContent = "Loading...";

  let response;
  try {
    response = await fetch(url);
  } catch (err) {
    resultsStatus.textContent = "Network error while contacting Scryfall.";
    return;
  }

  if (response.status === 404) {
    resultsStatus.textContent = resultsGrid.childElementCount
      ? "No more cards."
      : "No cards found for this search.";
    return;
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    resultsStatus.textContent = `Scryfall error: ${body?.details || response.statusText}`;
    return;
  }

  const data = await response.json();
  renderCards(data.data);

  const totalSoFar = resultsGrid.childElementCount;
  resultsStatus.textContent = `Showing ${totalSoFar}${data.total_cards ? ` of ${data.total_cards}` : ""} cards.`;

  if (data.has_more && data.next_page) {
    nextPageUrl = data.next_page;
    loadMoreBtn.hidden = false;
  } else {
    nextPageUrl = null;
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const query = buildQuery();
  resultsGrid.innerHTML = "";
  nextPageUrl = null;

  if (!query) {
    resultsStatus.textContent = "Add at least one filter before searching.";
    loadMoreBtn.hidden = true;
    return;
  }

  const apiUrl = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}&unique=cards&order=name`;
  fetchPage(apiUrl);
});

loadMoreBtn.addEventListener("click", () => {
  if (nextPageUrl) fetchPage(nextPageUrl);
});

form.addEventListener("input", updateQueryPreview);
form.addEventListener("change", updateQueryPreview);
updateQueryPreview();
