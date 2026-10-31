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
          <span class="eyebrow">FIFO INVENTORY DEMO</span>
          <h2>One Raw Material Price Change Demo (Product B: Medical Connector)</h2>
        </div>
        <span class="badge active">FIFO Cost Buffer</span>
      </div>
      <p>Demonstrating how <b>one raw material (Polypropylene Resin)</b> price changes from <b>01-Nov-2026</b>, while older stock keeps the older price, temporarily shielding product profitability before the full cost increase hits.</p>

      <!-- The Two Raw Material Batches -->
      <div class="demo-batch-grid">
        <div class="demo-batch-card old">
          <div class="demo-batch-header">
            <b>Batch PP-OLD · Older Stock</b>
            <span class="batch-badge old">Keeps Old Price</span>
          </div>
          <div style="font-size:12px; color:#234743; margin:6px 0;">
            Receipt Date: <b>2026-10-20</b> (Pre-Hike)<br>
            Available Stock: <b>100.00 kg</b><br>
            Landed Cost: <b>${money(baseline)} / kg</b> (Baseline USD $2.00 @ ₹${fx})
          </div>
          <small style="color:#577e74;">Capitalized at historical cost. Protected from the price hike.</small>
        </div>

        <div class="demo-batch-card new">
          <div class="demo-batch-header">
            <b>Batch PP-NEW · New Scenario Stock</b>
            <span class="batch-badge new">Price Changes from 01-Nov</span>
          </div>
          <div style="font-size:12px; color:#492820; margin:6px 0;">
            Receipt Date: <b>${effectiveDate}</b> (Post-Hike)<br>
            Available Stock: <b>200.00 kg</b><br>
            Landed Cost: <b>${money(scenarioLanded)} / kg</b> (+12% Hike USD $2.24 @ ₹${fx})
          </div>
          <small style="color:#925648;">Reflects the new replacement cost after supplier price hike.</small>
        </div>
      </div>

      <!-- Single Product Demonstration: Product B -->
      <div class="demo-run-box">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px;">
          <div>
            <span class="eyebrow">PRODUCT DEMONSTRATION</span>
            <h3 style="margin:4px 0 2px; font-size:16px;">Product B: Medical Connector Production Run</h3>
            <p style="font-size:11px; margin:0; color:#5b777a;">
              Each unit consumes <b>0.20 kg</b> net resin ÷ 0.95 (5% scrap) = <b>0.2105 kg gross resin</b>. Selling Price: <b>₹74.00</b>.
            </p>
          </div>
          <div style="text-align:right;">
            <label style="font-size:11px; font-weight:600; color:#1c4042; display:block;">
              Production Quantity (Units):
            </label>
            <input id="demo-prod-units" type="number" min="1" max="1400" value="500" style="padding:7px 10px; width:120px; font-size:13px; font-weight:700; border:1px solid #c9d8d5; border-radius:5px; text-align:right; margin-top:4px;">
          </div>
        </div>

        <div style="display:flex; gap:6px; margin:12px 0 16px; flex-wrap:wrap;">
          <span style="font-size:10px; color:#688285; align-self:center; margin-right:4px;">Quick Batch Sizes:</span>
          <button type="button" class="preset-btn" data-units="250">250 units (52.6 kg)</button>
          <button type="button" class="preset-btn" data-units="475">475 units (100 kg - Exact Old Batch)</button>
          <button type="button" class="preset-btn active" data-units="500">500 units (105.3 kg)</button>
          <button type="button" class="preset-btn" data-units="700">700 units (147.4 kg)</button>
        </div>

        <div id="fifo-demo-output"></div>
      </div>
    </section>
  `;

  // Attach Preset Buttons
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      $('#demo-prod-units').value = btn.dataset.units;
      updateFifo();
    };
  });

  $('#demo-prod-units').oninput = () => {
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.toggle('active', Number(b.dataset.units) === Number($('#demo-prod-units').value)));
    updateFifo();
  };

  updateFifo();
}

function updateFifo() {
  const units = Number($('#demo-prod-units').value);
  const container = $('#fifo-demo-output');
  if (!container) return;

  const p = products.find(x => x.id === 'B') || products[1];
  const grossPerUnit = grossResin(p);
  const convPerUnit = p.other + conversionCost(p);
  const reqResin = units * grossPerUnit;

  const costingDate = $('#date').value;
  const effectiveDate = $('#effective').value;
  const available = costingDate >= effectiveDate;
  const maxAvailableStock = available ? 300 : 100;
  const maxUnits = maxAvailableStock / grossPerUnit;

  if (!Number.isFinite(units) || units <= 0) {
    container.innerHTML = `
      <div class="alert" style="background:#fdf2ee; border-color:#f1c2b5; color:#a13b28;">
        Please enter a valid production batch size of units.
      </div>
    `;
    return;
  }

  if (reqResin > maxAvailableStock) {
    container.innerHTML = `
      <div class="alert" style="background:#fdf2ee; border-color:#f1c2b5; color:#a13b28;">
        ⚠️ <b>${units} units require ${reqResin.toFixed(2)} kg resin</b>, which exceeds available stock (${maxAvailableStock} kg) on ${costingDate}. Maximum possible is ~${Math.floor(maxUnits)} units.
      </div>
    `;
    return;
  }

  const fx = val('fx');
  const freight = val('freight');
  const duty = val('duty');
  const isPostHike = costingDate >= effectiveDate;
  const supplierUSD = getSupplierPrice(isPostHike);
  const newLandedRate = landed(supplierUSD, fx, freight, duty);

  const oldStock = 100;
  const oldDrawn = Math.min(reqResin, oldStock);
  const freshDrawn = Math.max(0, reqResin - oldDrawn);

  const oldCostTotal = oldDrawn * baseline;
  const freshCostTotal = freshDrawn * newLandedRate;
  const totalMaterialCost = oldCostTotal + freshCostTotal;
  const blendedRatePerKg = reqResin > 0 ? totalMaterialCost / reqResin : 0;
  const blendedResinPerUnit = totalMaterialCost / units;
  const totalCostPerUnit = blendedResinPerUnit + convPerUnit;
  const profitPerUnit = p.sp - totalCostPerUnit;
  const marginPct = (profitPerUnit / p.sp) * 100;

  // Comparison if made entirely at new price
  const replacementResinCost = reqResin * newLandedRate;
  const savings = replacementResinCost - totalMaterialCost;
  const replacementUnitCost = (replacementResinCost / units) + convPerUnit;
  const replacementProfit = p.sp - replacementUnitCost;
  const replacementMargin = (replacementProfit / p.sp) * 100;

  container.innerHTML = `
    <!-- Step by Step FIFO Allocation Cards -->
    <div class="demo-steps-container">
      <div class="demo-step-card old">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <span class="eyebrow" style="color:#2a7460;">STEP 1: CONSUME OLDER STOCK (KEEPS OLD PRICE)</span>
            <h4 style="margin:2px 0; font-size:13px; color:#184239;">Older Batch PP-OLD (Received Pre-Hike)</h4>
          </div>
          <b style="font-size:14px; color:#1e5b4c;">${money(oldCostTotal)}</b>
        </div>
        <p style="font-size:11px; margin:4px 0; color:#385e54;">
          <b>${oldDrawn.toFixed(2)} kg</b> drawn at older baseline price of <b>${money(baseline)} / kg</b>.
          ${oldDrawn >= 100 ? '<i>(Exhausts all 100 kg of older stock).</i>' : `<i>(${ (100 - oldDrawn).toFixed(2) } kg still remains in old stock).</i>`}
        </p>
      </div>

      <div class="demo-step-card new">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <span class="eyebrow" style="color:#9e4632;">STEP 2: DRAW NEW STOCK FOR RESIDUAL BALANCE</span>
            <h4 style="margin:2px 0; font-size:13px; color:#4a231b;">New Scenario Batch PP-NEW (From 01-Nov-2026)</h4>
          </div>
          <b style="font-size:14px; color:#9c3821;">${money(freshCostTotal)}</b>
        </div>
        <p style="font-size:11px; margin:4px 0; color:#5a372f;">
          <b>${freshDrawn.toFixed(2)} kg</b> drawn at new +12% price of <b>${money(newLandedRate)} / kg</b>.
        </p>
      </div>

      <div class="demo-step-card total">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <span class="eyebrow" style="color:#1d4b4a;">STEP 3: TOTAL MATERIAL ISSUE FOR THIS RUN</span>
            <h4 style="margin:2px 0; font-size:13px; color:#173b3c;">Combined ${reqResin.toFixed(2)} kg Gross Resin</h4>
          </div>
          <b style="font-size:16px; color:#173b3c;">${money(totalMaterialCost)}</b>
        </div>
        <p style="font-size:11px; margin:4px 0; color:#315456;">
          Blended Material Rate: <b>${money(blendedRatePerKg)} / kg</b> · Blended Resin Cost per Unit: <b>${money(blendedResinPerUnit)} / unit</b>.
        </p>
      </div>
    </div>

    <!-- Product B Profitability Result for this Run -->
    <div class="demo-kpi-summary">
      <div class="inv-stat-card">
        <label>Product B Run Cost / Unit</label>
        <strong>${money(totalCostPerUnit)}</strong>
        <small>Resin: ${money(blendedResinPerUnit)} + Conversion: ${money(convPerUnit)}</small>
      </div>

      <div class="inv-stat-card">
        <label>Selling Price (SP)</label>
        <strong>${money(p.sp)}</strong>
        <small>Catalog price per connector</small>
      </div>

      <div class="inv-stat-card ${profitPerUnit < 0 ? 'critical' : 'highlight'}">
        <label>Gross Profit / Unit</label>
        <strong style="color:${profitPerUnit < 0 ? '#b24c38' : '#1d5e4b'};">${money(profitPerUnit)}</strong>
        <small>Gross Margin: <b>${marginPct.toFixed(2)}%</b></small>
      </div>

      <div class="inv-stat-card highlight">
        <label>Savings via Older Stock</label>
        <strong style="color:#1d5e4b;">${money(savings)}</strong>
        <small>Saved vs buying all at new price</small>
      </div>
    </div>

    <!-- Key Finance Insight & Blindspot Callout -->
    <div class="alert" style="background:#f4fbf8; border-color:#bce5d8; color:#184a3c; margin-top:14px; font-size:12px; line-height:1.7;">
      💡 <b>The Demonstration Insight (Why Finance Could Not Tell at First):</b><br>
      • Because <b>older stock keeps the old price (${money(baseline)}/kg)</b>, this production run of ${units} units still appears profitable with a <b>+${marginPct.toFixed(2)}% gross margin</b> (+${money(profitPerUnit)}/unit profit).<br>
      • <b>The Hidden Trap</b>: Once this run consumes the remaining older stock, the very next batch must be produced entirely using new stock @ <b>${money(newLandedRate)}/kg</b>.<br>
      • Unit cost then jumps immediately to <b>${money(replacementUnitCost)}</b>, exceeding the selling price (${money(p.sp)}) and collapsing into a permanent <b style="color:#b24c38;">${replacementMargin.toFixed(2)}% net loss (${money(replacementProfit)} / unit)</b>!
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
