/* ---------------------------------------------------------
   Better Proxies — Cost Calculator
   Vanilla JS, no dependencies.
--------------------------------------------------------- */

const CARDS_PER_PAGE = 9;

/* ---------- formatting ---------- */
const fmtUSD = (n) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const fmtUSD2 = (n) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ---------- state ---------- */
const state = {
  cardCount: 500,
  maxCards: 3000,

  cutterCost: 60,
  punchCost: 16,
  laminatorCost: 40,

  fedexPageCost: 1.50,
  fLamPackSize: 200,
  fLamPackCost: 18,

  printerModel: "2850",   // "2850" | "8500" | "custom"
  customPrinterCost: 400,
  ownPrinter: false,
  paperPackSize: 100,
  paperPackCost: 20,
  inkYieldPages: 333,
  inkSetCost: 110,
  eLamPackSize: 200,
  eLamPackCost: 18,
};

/* ---------- cost engine ---------- */
function computeCost(cards, config) {
  if (cards <= 0) return { total: config.oneTime, consumables: [] };
  const pages = Math.ceil(cards / CARDS_PER_PAGE);
  let total = config.oneTime;
  const consumables = [];

  for (const c of config.consumables) {
    if (c.type === "per-page") {
      const cost = pages * c.costPerPage;
      total += cost;
      consumables.push({ name: c.name, qty: pages, unit: "pages", cost, waste: 0 });
    } else if (c.type === "pack") {
      const pagesPerPack = Math.max(1, c.packSize);
      const packs = Math.ceil(pages / pagesPerPack);
      const cost = packs * c.packCost;
      total += cost;
      consumables.push({ name: c.name, qty: packs, unit: "packs", cost, waste: packs * pagesPerPack - pages });
    }
  }
  return { total, consumables };
}

function getConfigs() {
  const sharedTools = state.cutterCost + state.punchCost + state.laminatorCost;
  const printerCost = state.ownPrinter
    ? 0
    : (state.printerModel === "2850" ? 250 : state.printerModel === "8500" ? 600 : state.customPrinterCost);

  const fedexConfig = {
    oneTime: sharedTools,
    consumables: [
      { name: "FedEx printing", type: "per-page", costPerPage: state.fedexPageCost },
      { name: "Laminator sheets", type: "pack", packSize: state.fLamPackSize, packCost: state.fLamPackCost },
    ],
  };

  const ecoConfig = {
    oneTime: sharedTools + printerCost,
    consumables: [
      { name: "Paper", type: "pack", packSize: state.paperPackSize, packCost: state.paperPackCost },
      { name: "Ink", type: "pack", packSize: state.inkYieldPages, packCost: state.inkSetCost },
      { name: "Laminator sheets", type: "pack", packSize: state.eLamPackSize, packCost: state.eLamPackCost },
    ],
  };

  return { sharedTools, printerCost, fedexConfig, ecoConfig };
}

/* ---------- render ---------- */
function render() {
  const { sharedTools, printerCost, fedexConfig, ecoConfig } = getConfigs();
  const cardCount = state.cardCount;
  const pages = Math.ceil(cardCount / CARDS_PER_PAGE);

  const fedexResult = computeCost(cardCount, fedexConfig);
  const ecoResult = computeCost(cardCount, ecoConfig);
  const fedexPerCard = cardCount > 0 ? fedexResult.total / cardCount : 0;
  const ecoPerCard = cardCount > 0 ? ecoResult.total / cardCount : 0;
  const winner = fedexResult.total <= ecoResult.total ? "fedex" : "eco";
  const diff = Math.abs(fedexResult.total - ecoResult.total);

  /* card count display */
  document.getElementById("cardCountValue").textContent = cardCount.toLocaleString();
  document.getElementById("pageCountValue").textContent = `(${pages} pages)`;

  /* shared tools badge */
  document.getElementById("sharedToolsBadge").textContent = fmtUSD(sharedTools);

  /* fedex badge */
  document.getElementById("fedexBadge").textContent = `${(state.fedexPageCost / CARDS_PER_PAGE * 100).toFixed(1)}¢/pg-card`;

  /* eco badge + ink sub */
  document.getElementById("ecoBadge").textContent = `${(ecoPerCard * 100).toFixed(1)}¢/card eff.`;
  document.getElementById("inkYieldCardsSub").textContent = `≈ ${(state.inkYieldPages * CARDS_PER_PAGE).toLocaleString()} cards`;

  /* receipt head */
  document.getElementById("receiptHead").textContent = `Cost Breakdown · ${cardCount.toLocaleString()} cards · ${pages} pages`;

  /* fedex receipt */
  document.getElementById("fedexTotal").textContent = fmtUSD2(fedexResult.total);
  document.getElementById("fedexTotal").style.color = winner === "fedex" ? "#2a7a3e" : "#2a2418";
  document.getElementById("fedexLines").innerHTML = buildLines(sharedTools, fedexResult.consumables);
  document.getElementById("fedexEffective").textContent = `${(fedexPerCard * 100).toFixed(1)}¢`;

  /* eco receipt */
  document.getElementById("ecoTotal").textContent = fmtUSD2(ecoResult.total);
  document.getElementById("ecoTotal").style.color = winner === "eco" ? "#2a7a3e" : "#2a2418";
  let ecoLinesHtml = buildLines(sharedTools, [], printerCost > 0 ? printerCost : null);
  ecoLinesHtml += buildLines(null, ecoResult.consumables);
  document.getElementById("ecoLines").innerHTML = ecoLinesHtml;
  document.getElementById("ecoEffective").textContent = `${(ecoPerCard * 100).toFixed(1)}¢`;

  /* verdict */
  const verdict = document.getElementById("verdict");
  verdict.innerHTML = winner === "fedex"
    ? `FedEx Office wins at ${cardCount.toLocaleString()} cards, saving you ${fmtUSD2(diff)}.`
    : `EcoTank wins at ${cardCount.toLocaleString()} cards, saving you ${fmtUSD2(diff)}.`;

  /* chart */
  drawChart(fedexConfig, ecoConfig, state.maxCards, cardCount);
}

function buildLines(sharedTools, consumables, printerCost) {
  let html = "";
  if (sharedTools !== null && sharedTools !== undefined) {
    html += `<div class="receipt-row"><span>Finishing supplies</span><span class="mono">${fmtUSD2(sharedTools)}</span></div>`;
  }
  if (printerCost) {
    html += `<div class="receipt-row"><span>Printer</span><span class="mono">${fmtUSD2(printerCost)}</span></div>`;
  }
  for (const c of consumables) {
    const qtyLabel = c.unit === "packs" ? ` (${c.qty}×)` : "";
    html += `<div class="receipt-row"><span>${c.name}${qtyLabel}</span><span class="mono">${fmtUSD2(c.cost)}</span></div>`;
    if (c.waste > 0) {
      const wasteLabel = c.name === "Ink" ? `${c.waste} pages of ink remaining` : `${c.waste} leftover sheets`;
      html += `<div class="receipt-waste">${wasteLabel}</div>`;
    }
  }
  return html;
}

/* ---------- chart ---------- */
function drawChart(fedexConfig, ecoConfig, maxCards, cardCount) {
  const maxPages = Math.ceil(maxCards / CARDS_PER_PAGE);
  const stride = maxPages > 400 ? Math.ceil(maxPages / 400) : 1;

  const points = [];
  for (let p = 0; p <= maxPages; p += stride) {
    const n = p * CARDS_PER_PAGE;
    points.push({
      n,
      fedex: computeCost(n, fedexConfig).total,
      eco: computeCost(n, ecoConfig).total,
    });
  }
  if (points[points.length - 1].n !== maxCards) {
    points.push({
      n: maxCards,
      fedex: computeCost(maxCards, fedexConfig).total,
      eco: computeCost(maxCards, ecoConfig).total,
    });
  }

  const maxY = Math.max(...points.map((p) => Math.max(p.fedex, p.eco))) * 1.08;

  // SVG geometry
  const W = 640, H = 320;
  const padL = 52, padR = 16, padT = 16, padB = 32;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const x = (n) => padL + (n / maxCards) * plotW;
  const y = (v) => padT + plotH - (v / maxY) * plotH;

  const stepPath = (key) => {
    let d = `M ${x(points[0].n)} ${y(points[0][key])}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const cur = points[i];
      d += ` L ${x(cur.n)} ${y(prev[key])}`;
      d += ` L ${x(cur.n)} ${y(cur[key])}`;
    }
    return d;
  };

  // gridlines (5 horizontal)
  let gridLines = "";
  const gridCount = 5;
  for (let i = 0; i <= gridCount; i++) {
    const gy = padT + (plotH / gridCount) * i;
    const val = maxY - (maxY / gridCount) * i;
    gridLines += `<line x1="${padL}" y1="${gy}" x2="${W - padR}" y2="${gy}" stroke="var(--line)" stroke-dasharray="3 3" />`;
    gridLines += `<text x="${padL - 8}" y="${gy + 4}" font-family="IBM Plex Mono, monospace" font-size="11" fill="var(--paper-dim)" text-anchor="end">$${Math.round(val)}</text>`;
  }

  // x-axis ticks (5)
  let xTicks = "";
  const tickCount = 5;
  for (let i = 0; i <= tickCount; i++) {
    const n = Math.round((maxCards / tickCount) * i);
    const tx = x(n);
    const label = n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : n;
    xTicks += `<text x="${tx}" y="${H - padB + 18}" font-family="IBM Plex Mono, monospace" font-size="11" fill="var(--paper-dim)" text-anchor="middle">${label}</text>`;
  }

  // "you are here" reference line
  const cx = x(Math.min(cardCount, maxCards));
  const refLine = `
    <line x1="${cx}" y1="${padT}" x2="${cx}" y2="${padT + plotH}" stroke="var(--red)" stroke-width="1.5" stroke-dasharray="4 3" />
    <text x="${cx}" y="${padT - 4}" font-family="-apple-system, sans-serif" font-size="11" fill="var(--red)" text-anchor="middle">you</text>
  `;

  const svg = `
    <svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
      ${gridLines}
      ${xTicks}
      <path d="${stepPath("fedex")}" fill="none" stroke="var(--teal)" stroke-width="2.5" />
      <path d="${stepPath("eco")}" fill="none" stroke="var(--gold)" stroke-width="2.5" />
      ${refLine}
    </svg>
  `;

  document.getElementById("chartContainer").innerHTML = svg;
}

/* ---------- wiring ---------- */
function bindNumber(id, key, isFloat) {
  const el = document.getElementById(id);
  el.addEventListener("input", () => {
    const v = isFloat ? parseFloat(el.value) : parseInt(el.value, 10);
    state[key] = isNaN(v) ? 0 : Math.max(0, v);
    render();
  });
}

function bindRange(id, key, onChange) {
  const el = document.getElementById(id);
  el.addEventListener("input", () => {
    state[key] = parseInt(el.value, 10);
    if (onChange) onChange();
    render();
  });
}

function init() {
  // card count slider
  bindRange("cardCount", "cardCount");

  // chart max pills
  document.querySelectorAll("[data-maxcards]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const v = parseInt(btn.dataset.maxcards, 10);
      state.maxCards = v;
      if (state.cardCount > v) {
        state.cardCount = v;
        document.getElementById("cardCount").value = v;
      }
      document.getElementById("cardCount").max = v;
      document.querySelectorAll("[data-maxcards]").forEach((b) => b.classList.toggle("active", b === btn));
      render();
    });
  });
  // default active
  document.querySelector('[data-maxcards="3000"]').classList.add("active");
  document.getElementById("cardCount").max = state.maxCards;

  // shared tools
  bindNumber("cutterCost", "cutterCost", true);
  bindNumber("punchCost", "punchCost", true);
  bindNumber("laminatorCost", "laminatorCost", true);

  // fedex
  bindNumber("fedexPageCost", "fedexPageCost", true);
  bindNumber("fLamPackSize", "fLamPackSize", false);
  bindNumber("fLamPackCost", "fLamPackCost", true);

  // printer pills
  document.querySelectorAll(".printer-pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.printerModel = btn.dataset.printer;
      state.ownPrinter = false;
      document.getElementById("ownPrinter").checked = false;
      document.querySelectorAll(".printer-pill").forEach((b) => b.classList.toggle("active", b === btn));
      document.getElementById("customPrinterField").style.display = state.printerModel === "custom" ? "block" : "none";
      render();
    });
  });
  document.querySelector('[data-printer="2850"]').classList.add("active");

  document.getElementById("customPrinterCost").addEventListener("input", (e) => {
    state.customPrinterCost = Math.max(0, parseFloat(e.target.value) || 0);
    render();
  });

  document.getElementById("ownPrinter").addEventListener("change", (e) => {
    state.ownPrinter = e.target.checked;
    render();
  });

  // eco fields
  bindNumber("paperPackSize", "paperPackSize", false);
  bindNumber("paperPackCost", "paperPackCost", true);
  bindNumber("inkYieldPages", "inkYieldPages", false);
  bindNumber("inkSetCost", "inkSetCost", true);
  bindNumber("eLamPackSize", "eLamPackSize", false);
  bindNumber("eLamPackCost", "eLamPackCost", true);

  render();
}

document.addEventListener("DOMContentLoaded", init);
