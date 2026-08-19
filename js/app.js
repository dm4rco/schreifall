const COLOR_ORDER = ["W", "U", "B", "R", "G"];

const form = document.getElementById("search-form");
const exactIdentityBox = document.getElementById("exact-identity");
const textModeSelect = document.getElementById("text-mode");
const textQueryInput = document.getElementById("text-query");
const mvMinInput = document.getElementById("mv-min");
const mvMaxInput = document.getElementById("mv-max");
const priceMaxInput = document.getElementById("price-max");
const commanderLegalBox = document.getElementById("commander-legal");
const excludeBasicsBox = document.getElementById("exclude-basics");
const sortOrderSelect = document.getElementById("sort-order");
const sortDirBtn = document.getElementById("sort-dir");
const copyLinkBtn = document.getElementById("copy-link");
const queryPreview = document.getElementById("query-preview-text");
const scryfallLink = document.getElementById("scryfall-link");
const resultsStatus = document.getElementById("results-status");
const resultsGrid = document.getElementById("results-grid");
const loadMoreBtn = document.getElementById("load-more");

let nextPageUrl = null;

function getSelectedValues(name) {
  return Array.from(form.querySelectorAll(`input[name="${name}"]:checked`)).map(el => el.value);
}

function quoteIfNeeded(value) {
  return /\s/.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value;
}

function buildQuery() {
  const parts = [];

  const colors = COLOR_ORDER.filter(c => getSelectedValues("color").includes(c));
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

  const types = getSelectedValues("type");
  if (types.length > 0) {
    parts.push(`(${types.map(t => `t:${t}`).join(" or ")})`);
  }

  const mvMin = mvMinInput.value.trim();
  const mvMax = mvMaxInput.value.trim();
  if (mvMin) parts.push(`mv>=${Number(mvMin)}`);
  if (mvMax) parts.push(`mv<=${Number(mvMax)}`);

  const priceMax = priceMaxInput.value.trim();
  if (priceMax) parts.push(`usd<=${Number(priceMax)}`);

  if (commanderLegalBox.checked) parts.push("legal:commander");
  if (excludeBasicsBox.checked) parts.push("-type:basic");

  return parts.join(" ").trim();
}

function getSort() {
  return { order: sortOrderSelect.value, dir: sortDirBtn.dataset.dir };
}

function updateSortButtonLabel() {
  const asc = sortDirBtn.dataset.dir === "asc";
  sortDirBtn.textContent = asc ? "↑ Ascending" : "↓ Descending";
}

function updateQueryPreview() {
  const query = buildQuery();
  const { order, dir } = getSort();
  queryPreview.textContent = query || "(no filters set — will match every card)";
  const base = query ? "https://scryfall.com/search" : "https://scryfall.com/search";
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  params.set("order", order);
  params.set("dir", dir);
  scryfallLink.href = query ? `${base}?${params.toString()}` : base;
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

// --- URL state (shareable / bookmarkable searches) ---

function formStateToParams() {
  const params = new URLSearchParams();
  const colors = getSelectedValues("color");
  if (colors.length) params.set("colors", colors.join(""));
  if (exactIdentityBox.checked) params.set("exact", "1");
  if (textQueryInput.value.trim()) {
    params.set("tmode", textModeSelect.value);
    params.set("tq", textQueryInput.value.trim());
  }
  const types = getSelectedValues("type");
  if (types.length) params.set("types", types.join(","));
  if (mvMinInput.value.trim()) params.set("mvmin", mvMinInput.value.trim());
  if (mvMaxInput.value.trim()) params.set("mvmax", mvMaxInput.value.trim());
  if (priceMaxInput.value.trim()) params.set("pricemax", priceMaxInput.value.trim());
  if (!commanderLegalBox.checked) params.set("legal", "0");
  if (!excludeBasicsBox.checked) params.set("nobasic", "0");
  params.set("order", sortOrderSelect.value);
  params.set("dir", sortDirBtn.dataset.dir);
  return params;
}

function paramsToFormState(params) {
  if (!params.toString()) return false;

  const colors = (params.get("colors") || "").split("").filter(Boolean);
  form.querySelectorAll('input[name="color"]').forEach(el => { el.checked = colors.includes(el.value); });

  exactIdentityBox.checked = params.get("exact") === "1";

  if (params.get("tq")) {
    textModeSelect.value = params.get("tmode") || "o";
    textQueryInput.value = params.get("tq");
  }

  const types = (params.get("types") || "").split(",").filter(Boolean);
  form.querySelectorAll('input[name="type"]').forEach(el => { el.checked = types.includes(el.value); });

  if (params.get("mvmin")) mvMinInput.value = params.get("mvmin");
  if (params.get("mvmax")) mvMaxInput.value = params.get("mvmax");
  if (params.get("pricemax")) priceMaxInput.value = params.get("pricemax");

  commanderLegalBox.checked = params.get("legal") !== "0";
  excludeBasicsBox.checked = params.get("nobasic") !== "0";

  if (params.get("order")) sortOrderSelect.value = params.get("order");
  sortDirBtn.dataset.dir = params.get("dir") === "desc" ? "desc" : "asc";
  updateSortButtonLabel();

  return true;
}

function runSearch({ updateUrl } = { updateUrl: true }) {
  const query = buildQuery();
  resultsGrid.innerHTML = "";
  nextPageUrl = null;

  if (updateUrl) {
    const params = formStateToParams();
    const newUrl = params.toString() ? `${location.pathname}?${params.toString()}` : location.pathname;
    history.replaceState(null, "", newUrl);
  }

  if (!query) {
    resultsStatus.textContent = "Add at least one filter before searching.";
    loadMoreBtn.hidden = true;
    return;
  }

  const { order, dir } = getSort();
  const apiUrl = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}&unique=cards&order=${order}&dir=${dir}`;
  fetchPage(apiUrl);
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  runSearch();
});

loadMoreBtn.addEventListener("click", () => {
  if (nextPageUrl) fetchPage(nextPageUrl);
});

sortDirBtn.addEventListener("click", () => {
  sortDirBtn.dataset.dir = sortDirBtn.dataset.dir === "asc" ? "desc" : "asc";
  updateSortButtonLabel();
  updateQueryPreview();
});

copyLinkBtn.addEventListener("click", async () => {
  const params = formStateToParams();
  const url = `${location.origin}${location.pathname}?${params.toString()}`;
  try {
    await navigator.clipboard.writeText(url);
    const original = copyLinkBtn.textContent;
    copyLinkBtn.textContent = "Copied!";
    setTimeout(() => { copyLinkBtn.textContent = original; }, 1500);
  } catch (err) {
    resultsStatus.textContent = "Couldn't copy link — copy the address bar URL instead.";
  }
});

form.addEventListener("input", updateQueryPreview);
form.addEventListener("change", updateQueryPreview);

updateSortButtonLabel();
const hadUrlState = paramsToFormState(new URLSearchParams(location.search));
updateQueryPreview();
if (hadUrlState) runSearch({ updateUrl: false });
