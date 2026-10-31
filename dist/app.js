import {
  products,
  baseline,
  landed,
  cost,
  margin,
  fifo,
  grossResin,
  conversionCost,
  resinCost,
  profit
} from './costing.js';

const $ = s => document.querySelector(s);
const money = v => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2
}).format(v);

let rate = baseline;
let selectedProductId = 'B'; // Default to Product B to clearly show the loss

function val(id) {
  return Number($('#' + id).value);
}

function getSupplierPrice(isPostHike) {
  // Base price is $2.00/kg; fixed 12% hike on/after 01-Nov-2026 makes it $2.24/kg
  return isPostHike ? 2.00 * 1.12 : 2.00;
}

function render() {
  const fx = val('fx');
  const freight = val('freight');
  const duty = val('duty');
  const costingDate = $('#date').value;
  const effectiveDate = $('#effective').value;

  if (fx <= 0 || freight < 0 || duty < 0 || duty > 100 || !costingDate || !effectiveDate) {
    return;
  }

  const isPostHike = costingDate >= effectiveDate;
  const supplierUSD = getSupplierPrice(isPostHike);
  const baseRate = landed(2.00, fx, freight, duty);
  rate = landed(supplierUSD, fx, freight, duty);

  // Update date preset button styles
  if ($('#btn-pre') && $('#btn-post')) {
    $('#btn-pre').classList.toggle('active', !isPostHike);
    $('#btn-post').classList.toggle('active', isPostHike);
  }

  // Update header status badge
  const headerStatus = $('#header-status');
  if (headerStatus) {
    headerStatus.textContent = isPostHike
      ? 'Post-Hike Active (+12% applied)'
      : 'Pre-Hike Active (Baseline pricing)';
    headerStatus.className = `badge ${isPostHike ? 'active' : ''}`;
  }

  // 1. AUTO-CALCULATION UNDER "RAW MATERIAL COST CONTROLS"
  const landedCalcBox = $('#landed-calc-box');
  if (landedCalcBox) {
    const fxTotal = supplierUSD * fx;
    const cifPlusFreight = fxTotal + freight;
    const dutyFactor = 1 + duty / 100;
    const deltaVsBase = rate - baseRate;
    const pctChangeVsBase = baseRate > 0 ? ((rate - baseRate) / baseRate) * 100 : 0;

    landedCalcBox.className = `landed-calc-box ${isPostHike ? '' : 'pre-hike'}`;
    landedCalcBox.innerHTML = `
      <div class="calc-title">
        ${isPostHike ? '● Price Hike Active (+12% from ' + effectiveDate + ')' : '○ Baseline Active (Prior to ' + effectiveDate + ')'} · USD @ ₹${fx.toFixed(1)}
      </div>
      <div class="calc-formula">
        Landed Cost / kg = [ ( Supplier USD × FX Rate ) + Freight ] × ( 1 + Duty % / 100 )
      </div>
      <div class="calc-eval">
        = [ ( $${supplierUSD.toFixed(2)} × ₹${fx.toFixed(1)} ) + ₹${freight.toFixed(1)} ] × ( 1 + ${duty}% )<br>
        = [ ₹${fxTotal.toFixed(2)} + ₹${freight.toFixed(2)} ] × ${dutyFactor.toFixed(2)} = ₹${cifPlusFreight.toFixed(2)} × ${dutyFactor.toFixed(2)}
      </div>
      <div class="calc-result">
        <span>Current Landed Rate: <b>${money(rate)} / kg</b></span>
        <span class="delta-tag ${deltaVsBase > 0 ? 'neg' : 'pos'}">
          ${deltaVsBase >= 0 ? '+' : ''}${money(deltaVsBase)} / kg (${deltaVsBase >= 0 ? '+' : ''}${pctChangeVsBase.toFixed(2)}%)
        </span>
      </div>
    `;
  }

  // Landed price display element
  $('#landed').textContent = money(rate);

  // Statistics calculation
  const losses = products.filter(p => margin(p, rate) < 0);
  const avgMargin = products.reduce((s, p) => s + margin(p, rate), 0) / products.length;
  const avgDelta = products.reduce((s, p) => s + (cost(p, rate) - cost(p, baseRate)), 0) / products.length;

  $('#stats').innerHTML = [
    ['Products tracked', '03', 'Portfolio under evaluation'],
    ['Average margin', avgMargin.toFixed(2) + '%', isPostHike ? 'Post-hike portfolio average' : 'Baseline portfolio average'],
    ['Total cost change / unit', money(avgDelta), isPostHike ? 'Average cost increase from resin' : 'No cost variance yet'],
    ['Loss-making products', String(losses.length).padStart(2, '0'), losses.length ? 'Attention required (Cost > SP)' : 'All products currently profitable']
  ].map((s, i) => `
    <div class="stat ${i === 3 && losses.length ? 'critical' : ''}">
      <label>${s[0]}</label>
      <strong>${s[1]}</strong>
      <small>${s[2]}</small>
    </div>
  `).join('');

  // 2. THREE PRODUCTS BASELINE VS SCENARIO MARGIN COMPARISON CARDS
  const prodCardsContainer = $('#product-overview-cards');
  if (prodCardsContainer) {
    prodCardsContainer.innerHTML = products.map(p => {
      const gross = grossResin(p);
      const conv = p.other + conversionCost(p);
      const baseResin = gross * baseRate;
      const currResin = gross * rate;
      const resinDelta = currResin - baseResin;
      const resinDeltaPct = baseResin > 0 ? (resinDelta / baseResin) * 100 : 0;

      const baseCost = baseResin + conv;
      const currCost = currResin + conv;
      const costDelta = currCost - baseCost;
      const costDeltaPct = baseCost > 0 ? (costDelta / baseCost) * 100 : 0;

      const resinSharePct = currCost > 0 ? (currResin / currCost) * 100 : 0;

      const baseProfit = p.sp - baseCost;
      const baseMargin = (baseProfit / p.sp) * 100;
      const currProfit = p.sp - currCost;
      const currMargin = (currProfit / p.sp) * 100;
      const marginDelta = currMargin - baseMargin;
      const isLoss = currProfit < 0;

      return `
        <div class="prod-overview-card ${isLoss ? 'critical' : ''}" data-product="${p.id}" tabindex="0" style="cursor:pointer;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
            <div>
              <span class="eyebrow" style="font-size:8px;">PRODUCT ${p.id}</span>
              <h3 style="margin:2px 0;">${p.name}</h3>
              <small style="color:#788f91;">Net: ${p.qty} kg · Gross (5% scrap): ${gross.toFixed(4)} kg</small>
            </div>
            <span class="pill ${isLoss ? 'bad' : currMargin < 10 ? 'warn' : ''}">
              ${isLoss ? 'Loss-Making' : currMargin < 10 ? 'Low Margin' : 'Healthy'}
            </span>
          </div>

          <!-- Resin Cost Breakdown -->
          <div class="cost-breakdown-subgrid">
            <div class="cost-sub-item">
              <label>Raw Resin Cost</label>
              <b><s>${money(baseResin)}</s> → ${money(currResin)}</b>
              <span class="delta-tag ${resinDelta > 0 ? 'neg' : 'pos'}" style="display:inline-block; margin-top:2px;">
                ${resinDelta > 0 ? '+' : ''}${money(resinDelta)} (${resinDeltaPct.toFixed(1)}%)
              </span>
            </div>
            <div class="cost-sub-item">
              <label>Conversion Costs</label>
              <b>${money(conv)}</b>
              <span style="font-size:9px; color:#7d9395; display:block;">Labour, Machine, Pack</span>
            </div>
          </div>

          <!-- Total Cost Comparison -->
          <div class="prod-card-row">
            <span><b>Total Product Cost</b></span>
            <span>
              <s>${money(baseCost)}</s> → <b>${money(currCost)}</b>
              <span class="delta-tag ${costDelta > 0 ? 'neg' : 'pos'}" style="margin-left:4px;">
                ${costDelta > 0 ? '+' : ''}${money(costDelta)} (+${costDeltaPct.toFixed(1)}%)
              </span>
            </span>
          </div>

          <!-- Resin Share of Total Cost -->
          <div class="prod-card-row">
            <span>Resin Share of Cost</span>
            <span>
              <span class="share-badge">${resinSharePct.toFixed(1)}% of total</span>
            </span>
          </div>

          <!-- Selling Price vs Total Cost -->
          <div class="prod-card-row">
            <span>Selling Price (SP)</span>
            <b>${money(p.sp)}</b>
          </div>

          <!-- Gross Margin & Profit -->
          <div class="prod-card-row">
            <span>Gross Margin %</span>
            <span>
              <s>${baseMargin.toFixed(1)}%</s> → <b style="color:${isLoss ? '#b24c38' : '#1e6853'};">${currMargin.toFixed(2)}%</b>
              <span class="delta-tag ${marginDelta < 0 ? 'neg' : 'pos'}" style="margin-left:4px;">
                ${marginDelta.toFixed(2)}%
              </span>
            </span>
          </div>

          <div class="prod-card-row">
            <span>Unit Profit (SP − Cost)</span>
            <b style="color:${isLoss ? '#b24c38' : '#1e6853'}; font-size:13px;">
              ${money(currProfit)} ${isLoss ? '⚠️ (NET LOSS)' : ''}
            </b>
          </div>

          <!-- Impact Explanation Banner -->
          <div class="resin-impact-banner ${isLoss ? '' : 'healthy'}">
            ${isLoss
              ? `⚠️ <b>Resin +12% wiped out all profit!</b> Resin accounts for <b>${resinSharePct.toFixed(1)}%</b> of product cost. +${money(resinDelta)} raw material hike pushed total cost (${money(currCost)}) past SP (${money(p.sp)}).`
              : `✓ <b>Absorbs cost increase.</b> +${money(costDelta)} total cost change leaves a positive gross margin of ${currMargin.toFixed(2)}%.`
            }
          </div>
        </div>
      `;
    }).join('');
  }

  // 3. TABLE ROWS SHOWING DETAILED RESIN AND TOTAL COST BREAKDOWN
  $('#rows').innerHTML = products.map(p => {
    const gross = grossResin(p);
    const conv = p.other + conversionCost(p);
    const baseResin = gross * baseRate;
    const currResin = gross * rate;
    const resinDelta = currResin - baseResin;

    const baseCost = baseResin + conv;
    const currCost = currResin + conv;
    const costDelta = currCost - baseCost;
    const costDeltaPct = baseCost > 0 ? (costDelta / baseCost) * 100 : 0;
    const resinSharePct = currCost > 0 ? (currResin / currCost) * 100 : 0;

    const baseProfit = p.sp - baseCost;
    const baseMargin = (baseProfit / p.sp) * 100;
    const currProfit = p.sp - currCost;
    const currMargin = (currProfit / p.sp) * 100;
    const marginDelta = currMargin - baseMargin;
    const isLoss = currProfit < 0;

    return `
      <tr data-product="${p.id}" tabindex="0">
        <td>
          <b>${p.name}</b>
          <small>PRD-00${p.id} · Net: ${p.qty} kg (Gross: ${gross.toFixed(4)} kg)</small>
        </td>
        <td><b>${money(p.sp)}</b></td>
        <td>
          <s>${money(baseResin)}</s> → <b>${money(currResin)}</b>
        </td>
        <td style="color:${resinDelta > 0 ? '#b24c38' : '#276953'}; font-weight:600;">
          ${resinDelta > 0 ? '+' : ''}${money(resinDelta)}
        </td>
        <td>${money(conv)}</td>
        <td>
          <s>${money(baseCost)}</s> → <b>${money(currCost)}</b>
        </td>
        <td style="color:${costDelta > 0 ? '#b24c38' : '#276953'}; font-weight:600;">
          ${costDelta > 0 ? '+' : ''}${money(costDelta)} <small style="display:block; color:#788f91;">(+${costDeltaPct.toFixed(1)}%)</small>
        </td>
        <td>
          <span class="share-badge">${resinSharePct.toFixed(1)}%</span>
        </td>
        <td style="color:${currProfit < 0 ? '#b24c38' : '#276953'}; font-weight:700;">
          ${money(currProfit)}
        </td>
        <td>
          <s>${baseMargin.toFixed(1)}%</s> → <b style="color:${isLoss ? '#b24c38' : '#276953'};">${currMargin.toFixed(2)}%</b>
        </td>
        <td style="color:${marginDelta < 0 ? '#b24c38' : '#276953'}; font-weight:600;">
          ${marginDelta > 0 ? '+' : ''}${marginDelta.toFixed(2)}%
        </td>
        <td>
          <span class="pill ${isLoss ? 'bad' : currMargin < 10 ? 'warn' : ''}">
            ${isLoss ? 'Loss-making' : currMargin < 10 ? 'Low margin' : 'Healthy'}
          </span>
        </td>
      </tr>
    `;
  }).join('');

  // Margin comparison chart
  $('#chart').innerHTML = products.map(p => {
    const m = margin(p, rate);
    const old = margin(p, baseRate);
    return `
      <div class="barrow">
        <div class="barname">
          <b>${p.name} (Product ${p.id})</b>
          <small>SP: ${money(p.sp)} · Total Cost: ${money(cost(p, rate))}</small>
        </div>
        <div class="barline">
          <div class="track">
            <div class="bar baseline" style="width:${Math.max(0, Math.min(100, (old / 35) * 100))}%"></div>
          </div>
          ${old.toFixed(2)}% (Pre-hike)
        </div>
        <div class="barline">
          <div class="track">
            <div class="bar ${m < 0 ? 'negative' : ''}" style="width:${Math.max(4, Math.min(100, (Math.abs(m) / 35) * 100))}%"></div>
          </div>
          <span style="color:${m < 0 ? '#b24c38' : 'inherit'}; font-weight:${m < 0 ? 'bold' : 'normal'}">
            ${m.toFixed(2)}% ${m < 0 ? '(Negative margin!)' : ''}
          </span>
        </div>
      </div>
    `;
  }).join('');

  // Critical Alert
  $('#alert').innerHTML = `
    <div class="alert" style="${losses.length ? 'background:#fdf2ee; border-color:#f1c2b5; color:#a13b28;' : ''}">
      ${losses.length
        ? `⚠️ <b>${losses.map(p => p.name).join(', ')} turns into a loss-making product!</b> Total Cost (${money(cost(losses[0], rate))}) exceeds selling price (${money(losses[0].sp)}). Net loss: <b>${money(profit(losses[0], rate))} / unit</b>.`
        : `✓ <b>All products remain profitable.</b> Current costing date does not cause negative margins.`}
    </div>
  `;

  // Render other views
  renderProducts();
  renderInventory();

  // Row and card click handlers to navigate to product details
  document.querySelectorAll('[data-product]').forEach(el => {
    const open = () => {
      show('products');
      const card = $('#card' + el.dataset.product);
      if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
    el.onclick = open;
    el.onkeydown = e => { if (e.key === 'Enter') open(); };
  });
}


function renderProducts() {
  $('#products').innerHTML = '<div class="detailgrid">' + products.map(p => `
    <section class="panel" id="card${p.id}">
      <span class="eyebrow">PRODUCT ${p.id}</span>
      <h2>${p.name}</h2>
      <p>Edit inputs per finished unit.</p>
      <table>
        <tbody>
          ${[
            ['Net resin · kg', 'qty'],
            ['Scrap loss · %', 'scrap'],
            ['Other BOM materials · ₹', 'other'],
            ['Labour · ₹', 'labour'],
            ['Machine · ₹', 'machine'],
            ['Packaging · ₹', 'packaging'],
            ['Sterilisation · ₹', 'sterilisation'],
            ['Selling price · ₹', 'sp']
          ].map(([label, key]) => `
            <tr>
              <td><label for="${p.id + key}">${label}</label></td>
              <td>
                <input id="${p.id + key}" data-id="${p.id}" data-key="${key}" type="number"
                  min="${key === 'sp' ? 0.01 : 0}"
                  ${key === 'scrap' ? 'max="99.99"' : ''}
                  step="any" value="${p[key]}">
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="landed">
        <span>Current standard cost</span>
        <strong>${money(cost(p, rate))}</strong>
      </div>
      <p>Gross resin input after scrap: <b>${grossResin(p).toFixed(6)} kg</b></p>
      <p>Gross margin: <b style="color:${margin(p, rate) < 0 ? '#b24c38' : '#276953'};">${margin(p, rate).toFixed(2)}%</b></p>
    </section>
  `).join('') + '</div>';

  $('#products').querySelectorAll('input').forEach(el => {
    el.onchange = async () => {
      if (!el.checkValidity() || el.value === '') {
        el.reportValidity();
        return;
      }
      const prod = products.find(p => p.id === el.dataset.id);
      prod[el.dataset.key] = Number(el.value);
      render();

      // Persist change to Neon PostgreSQL
      try {
        const payloadKeyMap = {
          sp: 'sp',
          qty: 'qty',
          scrap: 'scrap',
          other: 'other',
          labour: 'labour',
          machine: 'machine',
          packaging: 'packaging',
          sterilisation: 'sterilisation'
        };
        await fetch(`/api/products/${prod.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [payloadKeyMap[el.dataset.key]]: Number(el.value) })
        });
      } catch (e) {}
    };
  });
}

function renderInventory() {
  const costingDate = $('#date').value;
  const effectiveDate = $('#effective').value;
  const isPostHike = costingDate >= effectiveDate;
  const supplierUSD = getSupplierPrice(isPostHike);
  const fx = val('fx');
  const freight = val('freight');
  const duty = val('duty');
  const scenarioLanded = landed(supplierUSD, fx, freight, duty);

  $('#inventory').innerHTML = `
    <section class="panel">
      <div class="panelhead">
        <div>
          <span class="eyebrow">INVENTORY VALUATION & FIFO DISPATCH ENGINE</span>
          <h2>Existing Batches & Real-Time Stock Issue Analyzer</h2>
        </div>
        <span class="badge active">FIFO Stock Engine</span>
      </div>
      <p>Existing stock batches keep their original landed costs. When you specify a required production quantity, this engine analyzes batch consumption, calculates residual stock, and computes the exact blended cost.</p>

      <!-- Existing On-Hand Batches Table -->
      <h3 style="margin:20px 0 10px; font-size:14px; color:#183c3e;">1. Existing Warehouse Batches (On-Hand Inventory)</h3>
      <div class="tablewrap">
        <table class="batch-table">
          <thead>
            <tr>
              <th>Batch Identifier</th>
              <th>Receipt Date</th>
              <th>Price Tariff</th>
              <th>Initial Stock</th>
              <th>Unit Landed Cost</th>
              <th>Total Valuation</th>
              <th>Batch Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><b>PP-BATCH-001</b><small>Existing Old Batch · Silo A</small></td>
              <td>2026-10-20</td>
              <td>Pre-Hike (Baseline $2.00)</td>
              <td><b>100.00 kg</b></td>
              <td>${money(baseline)} / kg</td>
              <td>${money(100 * baseline)}</td>
              <td><span class="batch-badge old">Protected Old Cost</span></td>
            </tr>
            <tr>
              <td><b>PP-BATCH-002</b><small>Scenario New Batch · Silo B</small></td>
              <td>${effectiveDate}</td>
              <td>Post-Hike (+12% $2.24)</td>
              <td><b>200.00 kg</b></td>
              <td>${money(scenarioLanded)} / kg</td>
              <td>${money(200 * scenarioLanded)}</td>
              <td><span class="batch-badge new">Post-Hike Tariff</span></td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Interactive Analyzer Input Controls -->
      <h3 style="margin:25px 0 10px; font-size:14px; color:#183c3e;">2. Interactive Production Issue Requirement</h3>
      <p>Specify the required amount directly in kg, use quick presets, or calculate demand from finished product volume:</p>

      <div class="inv-grid">
        <!-- Direct kg Entry -->
        <div class="inv-calc-box">
          <label style="font-size:11px; font-weight:600; color:#23494b;">
            Option A: Specify Exact Resin Quantity (kg)
            <input id="issue" type="number" min="0" max="300" step="any" value="120" style="margin-top:8px;">
          </label>
          <div style="margin-top:10px; font-size:10px; color:#688082;">Quick Presets:</div>
          <div class="inv-preset-row">
            <button type="button" class="preset-btn" data-qty="30">30 kg</button>
            <button type="button" class="preset-btn" data-qty="50">50 kg</button>
            <button type="button" class="preset-btn active" data-qty="100">100 kg (Full Old Stock)</button>
            <button type="button" class="preset-btn" data-qty="120">120 kg</button>
            <button type="button" class="preset-btn" data-qty="200">200 kg</button>
            <button type="button" class="preset-btn" data-qty="300">300 kg (Max All)</button>
          </div>
        </div>

        <!-- Finished Product Demand Calculator -->
        <div class="inv-calc-box">
          <label style="font-size:11px; font-weight:600; color:#23494b;">Option B: Derive Demand from Finished Units</label>
          <p style="font-size:10px; margin:4px 0 10px;">Select product and units to automatically account for BOM scrap yield loss:</p>
          <div class="product-demand-row">
            <select id="prod-demand-select">
              ${products.map(p => `
                <option value="${p.id}" ${p.id === 'B' ? 'selected' : ''}>
                  ${p.name} (Gross: ${(p.qty / (1 - p.scrap / 100)).toFixed(4)} kg/unit)
                </option>
              `).join('')}
            </select>
            <input id="prod-demand-units" type="number" min="1" step="1" value="500" placeholder="Units">
            <button type="button" id="btn-apply-demand" class="btn-calc-apply">Apply Demand</button>
          </div>
          <div id="demand-helper-text" style="font-size:10px; color:#49796e; margin-top:8px;">
            500 units of Product B require <b>105.26 kg</b> gross resin.
          </div>
        </div>
      </div>

      <!-- Real-Time Dynamic Analysis Result Container -->
      <div id="fifo-analysis-container"></div>
    </section>
  `;

  // Attach Preset Buttons
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      $('#issue').value = btn.dataset.qty;
      updateFifo();
    };
  });

  // Attach Finished Product Demand Handler
  const updateDemandHelper = () => {
    const pId = $('#prod-demand-select').value;
    const units = Number($('#prod-demand-units').value) || 0;
    const p = products.find(x => x.id === pId);
    if (!p) return;
    const req = units * grossResin(p);
    $('#demand-helper-text').innerHTML = `${units} units of <b>${p.name}</b> require <b>${req.toFixed(2)} kg</b> gross resin (incl. ${p.scrap}% scrap).`;
  };

  $('#prod-demand-select').onchange = updateDemandHelper;
  $('#prod-demand-units').oninput = updateDemandHelper;

  $('#btn-apply-demand').onclick = () => {
    const pId = $('#prod-demand-select').value;
    const units = Number($('#prod-demand-units').value) || 0;
    const p = products.find(x => x.id === pId);
    if (!p) return;
    const req = Math.min(300, Math.max(0, units * grossResin(p)));
    $('#issue').value = req.toFixed(2);
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    updateFifo();
  };

  $('#issue').oninput = () => {
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.toggle('active', Number(b.dataset.qty) === Number($('#issue').value)));
    updateFifo();
  };

  updateFifo();
}

function updateFifo() {
  const q = Number($('#issue').value);
  const costingDate = $('#date').value;
  const effectiveDate = $('#effective').value;
  const available = costingDate >= effectiveDate;
  const maxAvailable = available ? 300 : 100;
  const container = $('#fifo-analysis-container');

  if (!container) return;

  if (!Number.isFinite(q) || q < 0) {
    container.innerHTML = `
      <div class="alert" style="background:#fdf2ee; border-color:#f1c2b5; color:#a13b28;">
        Please enter a valid positive resin requirement in kg.
      </div>
    `;
    return;
  }

  if (q > maxAvailable) {
    container.innerHTML = `
      <div class="alert" style="background:#fdf2ee; border-color:#f1c2b5; color:#a13b28;">
        ⚠️ <b>Requested quantity (${q} kg) exceeds available inventory (${maxAvailable} kg)</b> on costing date ${costingDate}.
        ${!available ? '<br>Note: The second batch (200 kg) is not yet received until ' + effectiveDate + '.' : ''}
      </div>
    `;
    return;
  }

  const fx = val('fx');
  const freight = val('freight');
  const duty = val('duty');
  const isPostHike = costingDate >= effectiveDate;
  const supplierUSD = getSupplierPrice(isPostHike);
  const scenarioLandedRate = landed(supplierUSD, fx, freight, duty);

  const oldStock = 100;
  const freshStock = available ? 200 : 0;
  const v = fifo(q, scenarioLandedRate, oldStock, freshStock);

  const oldCostTotal = v.old * baseline;
  const freshCostTotal = v.fresh * scenarioLandedRate;
  const oldPctDrawn = oldStock > 0 ? (v.old / oldStock) * 100 : 0;
  const freshPctDrawn = freshStock > 0 ? (v.fresh / freshStock) * 100 : 0;

  container.innerHTML = `
    <h3 style="margin:25px 0 10px; font-size:14px; color:#183c3e;">3. Real-Time Allocation Analysis (${q.toFixed(2)} kg Required)</h3>

    <!-- 4 Dynamic KPI Cards -->
    <div class="inv-stats-grid">
      <div class="inv-stat-card">
        <label>Total Issue Quantity</label>
        <strong>${q.toFixed(2)} kg</strong>
        <small>${((q / (oldStock + freshStock)) * 100).toFixed(1)}% of total available stock</small>
      </div>

      <div class="inv-stat-card">
        <label>Total Material Cost</label>
        <strong>${money(v.total)}</strong>
        <small>${money(oldCostTotal)} (Old) + ${money(freshCostTotal)} (New)</small>
      </div>

      <div class="inv-stat-card">
        <label>Blended Landed Rate</label>
        <strong>${money(v.blended)} / kg</strong>
        <small>vs Replacement Rate: ${money(scenarioLandedRate)}/kg</small>
      </div>

      <div class="inv-stat-card highlight">
        <label>Savings via Older Stock</label>
        <strong>${money(v.savings)}</strong>
        <small>Saved by consuming older ₹193.60 stock</small>
      </div>
    </div>

    <!-- Batch Depletion Breakdown Table -->
    <div class="tablewrap" style="margin-top:15px;">
      <table class="batch-table">
        <thead>
          <tr>
            <th>Batch</th>
            <th>Opening Stock</th>
            <th>Allocated / Drawn</th>
            <th>Remaining Stock</th>
            <th>Unit Cost</th>
            <th>Total Issue Cost</th>
            <th>Stock Depletion</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><b>PP-BATCH-001 (Old)</b><br><small>Rec: 2026-10-20</small></td>
            <td>100.00 kg</td>
            <td><b style="color:#216252;">${v.old.toFixed(2)} kg</b></td>
            <td><b>${v.remainingOld.toFixed(2)} kg</b></td>
            <td>${money(baseline)}/kg</td>
            <td><b>${money(oldCostTotal)}</b></td>
            <td style="width:140px;">
              <div style="font-size:9px; color:#678284;">${oldPctDrawn.toFixed(0)}% drawn</div>
              <div class="inv-progress-track">
                <div class="inv-progress-fill" style="width:${oldPctDrawn}%;"></div>
              </div>
            </td>
          </tr>
          <tr>
            <td><b>PP-BATCH-002 (New)</b><br><small>Rec: ${effectiveDate}</small></td>
            <td>${freshStock.toFixed(2)} kg</td>
            <td><b style="color:#b24f38;">${v.fresh.toFixed(2)} kg</b></td>
            <td><b>${v.remainingFresh.toFixed(2)} kg</b></td>
            <td>${money(scenarioLandedRate)}/kg</td>
            <td><b>${money(freshCostTotal)}</b></td>
            <td style="width:140px;">
              <div style="font-size:9px; color:#678284;">${freshPctDrawn.toFixed(0)}% drawn</div>
              <div class="inv-progress-track">
                <div class="inv-progress-fill new" style="width:${freshPctDrawn}%;"></div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Dynamic Mathematical Proof Box -->
    <div class="inv-step-math">
      <b>Live FIFO Valuation Proof for ${q.toFixed(2)} kg:</b><br>
      • Old Batch Contribution: ${v.old.toFixed(2)} kg × ${money(baseline)}/kg = <b>${money(oldCostTotal)}</b><br>
      • New Batch Contribution: ${v.fresh.toFixed(2)} kg × ${money(scenarioLandedRate)}/kg = <b>${money(freshCostTotal)}</b><br>
      -----------------------------------------------------------------------------------------------------<br>
      • Total Landed Issue Cost: ${money(oldCostTotal)} + ${money(freshCostTotal)} = <b>${money(v.total)}</b><br>
      • Blended Weighted Landed Rate: ${money(v.total)} ÷ ${q.toFixed(2)} kg = <b>${money(v.blended)} / kg</b><br>
      • Financial Benefit: ${v.old.toFixed(2)} kg × ( ${money(scenarioLandedRate)} − ${money(baseline)} ) = <b>${money(v.savings)} cost buffer preserved</b>.
    </div>
  `;
}


function show(id) {
  ['overview', 'products', 'inventory', 'method'].forEach(v => {
    const el = $('#' + v);
    if (el) el.hidden = v !== id;
  });

  document.querySelectorAll('nav button').forEach(b => {
    b.classList.toggle('active', b.dataset.view === id);
  });

  const btn = document.querySelector(`[data-view="${id}"]`);
  if (btn) $('#breadcrumb').textContent = btn.textContent.trim();
}

// Navigation button handlers
document.querySelectorAll('nav button').forEach(b => {
  b.onclick = () => show(b.dataset.view);
});

// Input event listeners
['fx', 'freight', 'duty', 'effective', 'date'].forEach(id => {
  const el = $('#' + id);
  if (el) el.addEventListener('input', render);
});

// Date preset buttons
if ($('#btn-pre')) {
  $('#btn-pre').onclick = () => {
    $('#date').value = '2026-10-31';
    render();
  };
}
if ($('#btn-post')) {
  $('#btn-post').onclick = () => {
    $('#date').value = '2026-11-01';
    render();
  };
}

// Reset button handler
$('#reset').onclick = () => {
  $('#fx').value = 96;
  $('#freight').value = 10;
  $('#duty').value = 10;
  $('#effective').value = '2026-11-01';
  $('#date').value = '2026-11-01';
  render();
};

// CSV Export
$('#export').onclick = () => {
  const costingDate = $('#date').value;
  const fx = val('fx');
  const freight = val('freight');
  const duty = val('duty');
  const baseRate = landed(2.00, fx, freight, duty);

  const rows = [
    ['CalculateRaw Manufacturing Total Cost & Margin Report'],
    ['Generated On', new Date().toISOString()],
    ['Costing Date', costingDate],
    ['Baseline Landed Resin Cost / kg', baseRate.toFixed(4)],
    ['Current Landed Resin Cost / kg', rate.toFixed(4)],
    ['Resin Landed Rate Change / kg', (rate - baseRate).toFixed(4)],
    [],
    [
      'Product ID',
      'Product Name',
      'Selling Price (SP)',
      'Gross Resin Input (kg)',
      'Baseline Resin Cost',
      'Current Resin Cost',
      'Resin Cost Delta',
      'Conversion Overheads',
      'Baseline Total Cost',
      'Current Total Cost',
      'Total Cost Delta',
      'Total Cost Delta %',
      'Resin Share of Total %',
      'Unit Profit (SP - Cost)',
      'Baseline Margin %',
      'Current Margin %',
      'Margin Delta %',
      'Profitability Status'
    ],
    ...products.map(p => {
      const gross = grossResin(p);
      const conv = p.other + conversionCost(p);
      const baseResin = gross * baseRate;
      const currResin = gross * rate;
      const resinDelta = currResin - baseResin;

      const baseCost = baseResin + conv;
      const currCost = currResin + conv;
      const costDelta = currCost - baseCost;
      const costDeltaPct = baseCost > 0 ? (costDelta / baseCost) * 100 : 0;
      const resinSharePct = currCost > 0 ? (currResin / currCost) * 100 : 0;

      const baseProfit = p.sp - baseCost;
      const baseMargin = (baseProfit / p.sp) * 100;
      const currProfit = p.sp - currCost;
      const currMargin = (currProfit / p.sp) * 100;
      const marginDelta = currMargin - baseMargin;

      return [
        p.id,
        `"${p.name}"`,
        p.sp.toFixed(2),
        gross.toFixed(4),
        baseResin.toFixed(2),
        currResin.toFixed(2),
        resinDelta.toFixed(2),
        conv.toFixed(2),
        baseCost.toFixed(2),
        currCost.toFixed(2),
        costDelta.toFixed(2),
        costDeltaPct.toFixed(2) + '%',
        resinSharePct.toFixed(2) + '%',
        currProfit.toFixed(2),
        baseMargin.toFixed(2) + '%',
        currMargin.toFixed(2) + '%',
        marginDelta.toFixed(2) + '%',
        currProfit < 0 ? 'LOSS-MAKING' : currMargin < 10 ? 'LOW-MARGIN' : 'HEALTHY'
      ];
    })
  ];

  const csvContent = rows.map(r => r.join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `calculateraw-cost-report-${costingDate}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// Calculation Guide View Content
$('#method').innerHTML = `
  <section class="panel guide">
    <span class="eyebrow">MATHEMATICAL PRINCIPLES & GOVERNANCE</span>
    <h2>How CalculateRaw Builds Product Costs (Baseline FX @ 96)</h2>
    <p>This engine resolves the question of why finance could not tell which product lost margin when imported resin prices increased by 12% on 01-Nov-2026.</p>

    <h2>1. Imported Landed Cost Equation (Baseline FX = 96)</h2>
    <p>Raw polypropylene (PP) resin is purchased in USD. The landed cost includes the USD contract price converted at current exchange rates (baseline ₹96/USD), plus freight, plus customs import duties applied to CIF value:</p>
    <div class="eq-formula-box">
      Landed Cost (₹/kg) = [ ( USD Supplier Price × FX Rate ) + Freight per kg ] × ( 1 + Import Duty % / 100 )
    </div>
    <p>• Prior to 01-Nov-2026: ($2.00 × 96 + 10) × 1.10 = <b>₹222.20 / kg</b><br>
       • From 01-Nov-2026 (+12% hike): ($2.24 × 96 + 10) × 1.10 = <b>₹247.544 / kg</b> (+₹25.344 / kg increase)</p>

    <h2>2. Scrap Loss Divisor (Yield Loss)</h2>
    <p>In manufacturing, scrap cannot simply be added as a percentage of net weight without understating material consumption. It must be computed as a yield divisor:</p>
    <div class="eq-formula-box">
      Gross Input Required = Net Finished Product Weight ÷ ( 1 − Scrap Rate )
    </div>
    <p>For Product B (0.20 kg net weight with 5% scrap): 0.20 ÷ 0.95 = <b>0.210526 kg</b> of gross resin consumed per finished connector.</p>

    <h2>3. Product Standard Cost & Conversion Overheads</h2>
    <p>The standard unit cost sums material cost and conversion overheads:</p>
    <div class="eq-formula-box">
      Standard Cost = ( Gross Resin Input × Landed Cost/kg ) + Other BOM Materials + Labour + Machine + Packaging + Sterilisation
    </div>

    <h2>4. The Finance Blindspot: Why Product B Collapsed</h2>
    <p>Product B (Medical Connector) had the highest resin intensity (0.20 kg net, 0.2105 kg gross) and resin accounts for <b>66.1% of its total manufacturing cost</b>. At baseline (FX 96), its cost was ₹70.78 against an SP of ₹74.00 (+4.35% margin). When resin increased by 12%, Product B absorbed a cost increase of <b>+₹5.34 per unit</b>, elevating its cost to <b>₹76.11</b>, exceeding its selling price of <b>₹74.00</b> (resulting in a <b>-2.86% gross margin loss</b>).</p>

    <h2>5. FIFO Inventory Valuation & Effective Date</h2>
    <p>While the standard replacement cost updates on 01-Nov-2026, existing warehouse stock received before 01-Nov-2026 (Batch PP-001) retains its historical valuation of ₹222.20/kg. As production draws inventory, FIFO dispenses the older lot first, preserving balance sheet integrity.</p>
  </section>
`;

// Initial Render
render();

// Sync with Backend Neon PostgreSQL API
async function syncFromBackend() {
  try {
    const res = await fetch('/api/products');
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data) && json.data.length) {
        json.data.forEach(dbProd => {
          const local = products.find(p => p.id === dbProd.id);
          if (local) {
            Object.assign(local, dbProd);
          }
        });
        render();
        console.log('✅ Synchronized products with Neon PostgreSQL database');
      }
    }
  } catch (e) {
    // Client works offline if backend is unreachable
  }
}

syncFromBackend();
