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
const legendaryFilterSelect = document.getElementById("legendary-filter");
const sortOrderSelect = document.getElementById("sort-order");
const sortDirBtn = document.getElementById("sort-dir");
const copyLinkBtn = document.getElementById("copy-link");
const saveNameInput = document.getElementById("save-name");
const saveSearchBtn = document.getElementById("save-search-btn");
const savedListEl = document.getElementById("saved-list");
const queryPreview = document.getElementById("query-preview-text");
const scryfallLink = document.getElementById("scryfall-link");
const resultsStatus = document.getElementById("results-status");
const resultsGrid = document.getElementById("results-grid");
const loadMoreBtn = document.getElementById("load-more");
const copyNamesBtn = document.getElementById("copy-names");
const cardModal = document.getElementById("card-modal");
const modalContent = document.getElementById("modal-content");
const modalCloseBtn = document.getElementById("modal-close");

const SAVED_SEARCHES_KEY = "schreifall:savedSearches";
const CORE_TYPES = ["creature", "instant", "sorcery", "artifact", "enchantment", "planeswalker", "battle", "land"];

let nextPageUrl = null;

function getSelectedValues(name) {
  return Array.from(form.querySelectorAll(`input[name="${name}"]:checked`)).map(el => el.value);
}

function quoteIfNeeded(value) {
  return /\s/.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value;
}

function textClauseFor(mode, term) {
  if (mode === "o") return `o:${quoteIfNeeded(term)}`;
  if (mode === "otag") return `otag:${term.replace(/\s+/g, "-")}`;
  if (mode === "name") return `name:${quoteIfNeeded(term)}`;
  return "";
}

function buildTextClause() {
  const mode = textModeSelect.value;
  const terms = textQueryInput.value.split(",").map(t => t.trim()).filter(Boolean);
  if (terms.length === 0) return null;
  if (terms.length === 1) return textClauseFor(mode, terms[0]);
  return `(${terms.map(t => textClauseFor(mode, t)).join(" or ")})`;
}

function buildQuery() {
  const parts = [];

  const colors = COLOR_ORDER.filter(c => getSelectedValues("color").includes(c));
  if (colors.length > 0) {
    const op = exactIdentityBox.checked ? "=" : "<=";
    parts.push(`id${op}${colors.join("")}`);
  }

  const textClause = buildTextClause();
  if (textClause) parts.push(textClause);

  const types = getSelectedValues("type");
  if (types.length > 0) {
    parts.push(`(${types.map(t => `t:${t}`).join(" or ")})`);
  }

  const mvMin = mvMinInput.value.trim();
  const mvMax = mvMaxInput.value.trim();
  if (mvMin) parts.push(`mv>=${Number(mvMin)}`);
  if (mvMax) parts.push(`mv<=${Number(mvMax)}`);

  const priceMax = priceMaxInput.value.trim();
  if (priceMax) parts.push(`eur<=${Number(priceMax)}`);

  if (commanderLegalBox.checked) parts.push("legal:commander");
  if (excludeBasicsBox.checked) parts.push("-type:basic");

  if (legendaryFilterSelect.value === "only") parts.push("t:legendary");
  else if (legendaryFilterSelect.value === "exclude") parts.push("-t:legendary");

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

function cardImageUrl(card, size = "normal") {
  if (card.image_uris) return card.image_uris[size] || card.image_uris.normal;
  if (card.card_faces && card.card_faces[0].image_uris) {
    return card.card_faces[0].image_uris[size] || card.card_faces[0].image_uris.normal;
  }
  return null;
}

function cardMeta(card) {
  const face = card.card_faces && card.card_faces.length ? card.card_faces[0] : card;
  const manaCost = (card.mana_cost || face.mana_cost || "").replace(/[{}]/g, "");
  const typeLine = card.type_line || face.type_line || "";
  const oracleText = card.oracle_text
    || (card.card_faces ? card.card_faces.map(f => f.oracle_text).filter(Boolean).join(" // ") : "");
  return { manaCost, typeLine, oracleText };
}

function renderCards(cards, container = resultsGrid) {
  for (const card of cards) {
    const item = document.createElement("div");
    item.className = "card-item";

    const { manaCost, typeLine, oracleText } = cardMeta(card);

    const link = document.createElement("a");
    link.href = card.scryfall_uri;
    link.target = "_blank";
    link.rel = "noopener";
    if (oracleText) link.title = oracleText;
    link.addEventListener("click", (event) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey) return;
      event.preventDefault();
      showCardDetail(card);
    });

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

    const meta = document.createElement("span");
    meta.className = "card-meta";
    meta.textContent = [manaCost, typeLine].filter(Boolean).join(" · ");
    link.appendChild(meta);

    item.appendChild(link);
    container.appendChild(item);
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
  copyNamesBtn.hidden = totalSoFar === 0;

  if (data.has_more && data.next_page) {
    nextPageUrl = data.next_page;
    loadMoreBtn.hidden = false;
  } else {
    nextPageUrl = null;
  }
}

// --- Card detail modal + similar cards ---

function coreTypeOf(typeLine) {
  const lower = (typeLine || "").toLowerCase();
  return CORE_TYPES.find(t => lower.includes(t)) || null;
}

const GENERIC_SUBTYPES = new Set(["Human"]);

function subtypesOf(typeLine) {
  const dashIdx = (typeLine || "").indexOf("—");
  if (dashIdx === -1) return [];
  return typeLine.slice(dashIdx + 1).trim().split(/\s+/).filter(Boolean);
}

function relevantSubtypes(typeLine) {
  const subtypes = subtypesOf(typeLine);
  const filtered = subtypes.filter(s => !GENERIC_SUBTYPES.has(s));
  return filtered.length ? filtered : subtypes;
}

function buildSimilarQuery(card) {
  const parts = [];

  const colors = COLOR_ORDER.filter(c => (card.color_identity || []).includes(c));
  parts.push(`id<=${colors.length ? colors.join("") : "c"}`);

  const subtypes = relevantSubtypes(cardMeta(card).typeLine);
  if (subtypes.length) {
    parts.push(`(${subtypes.map(s => `t:${quoteIfNeeded(s)}`).join(" or ")})`);
  } else {
    const t = coreTypeOf(cardMeta(card).typeLine);
    if (t) parts.push(`t:${t}`);
  }

  parts.push(`-name:${quoteIfNeeded(card.name)}`);
  parts.push("legal:commander");
  parts.push("-type:basic");

  return { query: parts.join(" "), subtypes };
}

async function loadSimilarCards(card) {
  const grid = document.getElementById("similar-grid");
  const status = document.getElementById("similar-status");
  const heading = document.getElementById("similar-heading");
  if (!grid || !status) return;

  status.textContent = "Loading similar cards...";
  grid.innerHTML = "";

  const { query, subtypes } = buildSimilarQuery(card);
  if (heading) {
    heading.textContent = subtypes.length
      ? `Similar cards — other ${subtypes.join(" / ")}`
      : "Similar cards";
  }
  let response;
  try {
    response = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}&unique=cards&order=edhrec&dir=asc`);
  } catch (err) {
    status.textContent = "Network error loading similar cards.";
    return;
  }

  if (response.status === 404) {
    status.textContent = "No similar cards found.";
    return;
  }
  if (!response.ok) {
    status.textContent = "Couldn't load similar cards.";
    return;
  }

  const data = await response.json();
  renderCards(data.data.slice(0, 12), grid);
  status.textContent = "";
}

function renderModalCard(card) {
  const { manaCost, typeLine, oracleText } = cardMeta(card);
  const imgUrl = cardImageUrl(card, "large");

  modalContent.innerHTML = "";

  const wrap = document.createElement("div");
  wrap.className = "modal-card";

  if (imgUrl) {
    const img = document.createElement("img");
    img.src = imgUrl;
    img.alt = card.name;
    wrap.appendChild(img);
  }

  const details = document.createElement("div");
  details.className = "modal-details";

  const h2 = document.createElement("h2");
  h2.textContent = card.name;
  details.appendChild(h2);

  const manaType = document.createElement("p");
  manaType.className = "mana-type";
  manaType.textContent = [manaCost, typeLine].filter(Boolean).join(" · ");
  details.appendChild(manaType);

  if (oracleText) {
    const oracle = document.createElement("p");
    oracle.className = "oracle-text";
    oracle.textContent = oracleText;
    details.appendChild(oracle);
  }

  const metaRow = document.createElement("div");
  metaRow.className = "modal-meta-row";
  const metaBits = [];
  if (card.set_name) metaBits.push(card.set_name);
  if (card.rarity) metaBits.push(card.rarity.charAt(0).toUpperCase() + card.rarity.slice(1));
  if (card.prices && card.prices.eur) metaBits.push(`€${card.prices.eur}`);
  else if (card.prices && card.prices.usd) metaBits.push(`$${card.prices.usd}`);
  for (const bit of metaBits) {
    const span = document.createElement("span");
    span.textContent = bit;
    metaRow.appendChild(span);
  }
  details.appendChild(metaRow);

  const linkRow = document.createElement("div");
  linkRow.className = "modal-links";

  const link = document.createElement("a");
  link.className = "scryfall-out";
  link.href = card.scryfall_uri;
  link.target = "_blank";
  link.rel = "noopener";
  link.textContent = "View on Scryfall ↗";
  linkRow.appendChild(link);

  if (card.set && card.collector_number) {
    const taggerLink = document.createElement("a");
    taggerLink.className = "scryfall-out";
    taggerLink.href = `https://tagger.scryfall.com/card/${card.set}/${card.collector_number}`;
    taggerLink.target = "_blank";
    taggerLink.rel = "noopener";
    taggerLink.textContent = "View tags on Scryfall Tagger ↗";
    linkRow.appendChild(taggerLink);
  }

  details.appendChild(linkRow);

  wrap.appendChild(details);
  modalContent.appendChild(wrap);

  const similarSection = document.createElement("div");
  similarSection.className = "similar-section";

  const h3 = document.createElement("h3");
  h3.id = "similar-heading";
  h3.textContent = "Similar cards";
  similarSection.appendChild(h3);

  const status = document.createElement("p");
  status.className = "hint";
  status.id = "similar-status";
  status.textContent = "Loading similar cards...";
  similarSection.appendChild(status);

  const grid = document.createElement("div");
  grid.className = "results-grid similar-grid";
  grid.id = "similar-grid";
  similarSection.appendChild(grid);

  modalContent.appendChild(similarSection);
}

function updateCardParam(id) {
  const params = new URLSearchParams(location.search);
  if (id) params.set("card", id);
  else params.delete("card");
  const newUrl = params.toString() ? `${location.pathname}?${params.toString()}` : location.pathname;
  history.pushState(null, "", newUrl);
}

function showCardDetail(card, { updateUrl = true } = {}) {
  cardModal.hidden = false;
  document.body.classList.add("modal-open");
  if (updateUrl) updateCardParam(card.id);
  renderModalCard(card);
  loadSimilarCards(card);
}

async function openCardById(id) {
  cardModal.hidden = false;
  document.body.classList.add("modal-open");
  modalContent.innerHTML = "";
  const loading = document.createElement("p");
  loading.className = "hint";
  loading.textContent = "Loading card...";
  modalContent.appendChild(loading);

  try {
    const response = await fetch(`https://api.scryfall.com/cards/${id}`);
    if (!response.ok) throw new Error("not found");
    const card = await response.json();
    showCardDetail(card, { updateUrl: false });
  } catch (err) {
    modalContent.innerHTML = "";
    const errorMsg = document.createElement("p");
    errorMsg.className = "hint";
    errorMsg.textContent = "Couldn't load this card.";
    modalContent.appendChild(errorMsg);
  }
}

function closeCardDetail() {
  cardModal.hidden = true;
  document.body.classList.remove("modal-open");
  modalContent.innerHTML = "";
  if (new URLSearchParams(location.search).has("card")) updateCardParam(null);
}

modalCloseBtn.addEventListener("click", () => closeCardDetail());
cardModal.addEventListener("click", (event) => {
  if (event.target === cardModal) closeCardDetail();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !cardModal.hidden) closeCardDetail();
});
window.addEventListener("popstate", () => {
  const id = new URLSearchParams(location.search).get("card");
  if (id) openCardById(id);
  else {
    cardModal.hidden = true;
    document.body.classList.remove("modal-open");
    modalContent.innerHTML = "";
  }
});

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
  if (legendaryFilterSelect.value) params.set("legendary", legendaryFilterSelect.value);
  params.set("order", sortOrderSelect.value);
  params.set("dir", sortDirBtn.dataset.dir);
  return params;
}

const SEARCH_PARAM_KEYS = ["colors", "tq", "types", "mvmin", "mvmax", "pricemax", "legal", "nobasic", "legendary"];

function paramsToFormState(params) {
  if (!SEARCH_PARAM_KEYS.some(key => params.has(key))) return false;

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
  legendaryFilterSelect.value = params.get("legendary") || "";

  if (params.get("order")) sortOrderSelect.value = params.get("order");
  sortDirBtn.dataset.dir = params.get("dir") === "desc" ? "desc" : "asc";
  updateSortButtonLabel();

  return true;
}

function runSearch({ updateUrl } = { updateUrl: true }) {
  const query = buildQuery();
  resultsGrid.innerHTML = "";
  nextPageUrl = null;
  copyNamesBtn.hidden = true;

  if (updateUrl) {
    const params = formStateToParams();
    const existingCard = new URLSearchParams(location.search).get("card");
    if (existingCard) params.set("card", existingCard);
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

copyNamesBtn.addEventListener("click", async () => {
  const names = Array.from(resultsGrid.querySelectorAll(".card-name")).map(el => `1 ${el.textContent}`);
  if (names.length === 0) return;
  try {
    await navigator.clipboard.writeText(names.join("\n"));
    const original = copyNamesBtn.textContent;
    copyNamesBtn.textContent = "Copied!";
    setTimeout(() => { copyNamesBtn.textContent = original; }, 1500);
  } catch (err) {
    resultsStatus.textContent = "Couldn't copy names to clipboard.";
  }
});

// --- Saved searches (localStorage) ---

function loadSavedSearches() {
  try {
    return JSON.parse(localStorage.getItem(SAVED_SEARCHES_KEY)) || [];
  } catch (err) {
    return [];
  }
}

function persistSavedSearches(list) {
  localStorage.setItem(SAVED_SEARCHES_KEY, JSON.stringify(list));
}

function renderSavedSearches() {
  const list = loadSavedSearches();
  savedListEl.innerHTML = "";

  if (list.length === 0) {
    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent = 'No saved searches yet — build one below and click "Save search".';
    savedListEl.appendChild(hint);
    return;
  }

  for (const entry of list) {
    const chip = document.createElement("div");
    chip.className = "saved-chip";

    const loadBtn = document.createElement("button");
    loadBtn.type = "button";
    loadBtn.className = "saved-chip-load";
    loadBtn.textContent = entry.name;
    loadBtn.addEventListener("click", () => {
      paramsToFormState(new URLSearchParams(entry.params));
      updateQueryPreview();
      runSearch();
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "saved-chip-delete";
    deleteBtn.textContent = "×";
    deleteBtn.setAttribute("aria-label", `Delete saved search "${entry.name}"`);
    deleteBtn.addEventListener("click", () => {
      persistSavedSearches(loadSavedSearches().filter(s => s.id !== entry.id));
      renderSavedSearches();
    });

    chip.appendChild(loadBtn);
    chip.appendChild(deleteBtn);
    savedListEl.appendChild(chip);
  }
}

saveSearchBtn.addEventListener("click", () => {
  const params = formStateToParams();
  if (!buildQuery()) {
    resultsStatus.textContent = "Add at least one filter before saving a search.";
    return;
  }
  const name = saveNameInput.value.trim() || queryPreview.textContent.slice(0, 60);
  const list = loadSavedSearches();
  list.push({ id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, name, params: params.toString() });
  persistSavedSearches(list);
  saveNameInput.value = "";
  renderSavedSearches();
});

form.addEventListener("input", updateQueryPreview);
form.addEventListener("change", updateQueryPreview);

updateSortButtonLabel();
renderSavedSearches();
const initialParams = new URLSearchParams(location.search);
const hadUrlState = paramsToFormState(initialParams);
updateQueryPreview();
if (hadUrlState) runSearch({ updateUrl: false });
if (initialParams.get("card")) openCardById(initialParams.get("card"));
