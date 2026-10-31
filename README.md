# CalculateRaw
Interactive manufacturing cost, BOM rollup, and real-time margin calculation engine. Vanilla HTML, modern CSS, and JavaScript (ES Modules) with zero external dependencies.

## Key Features
- **Fixed Baseline Quantum (USD FX = 96)**: Baseline exchange rate fixed at ₹96/USD.
- **Auto-Calculated Landed Resin Cost**:
  - Baseline ($2.00 @ FX 96, Freight 10, Duty 10%): **₹222.20 / kg**
  - Post-Hike ($2.24 @ FX 96, Freight 10, Duty 10%): **₹247.544 / kg** (+₹25.344/kg or +11.41%)
- **Raw Resin vs Total Cost Rollup**: Shows exact breakdown of raw resin cost increase, non-resin conversion costs, and resulting total finished product cost increase.
- **Resin Cost Share Analysis**: Demonstrates how resin intensity (% of total cost) dictates product price sensitivity.
- **Selling Price (SP) Profitability Comparison**: Compares total cost directly against selling price, showing baseline profit, post-hike profit erosion, and margin collapse.
- **FIFO Inventory Stock Valuation**: Historical warehouse batches keep their pre-hike cost, demonstrating FIFO issue blending.
- **CSV Export**: One-click download of full portfolio cost, resin share, and margin analysis.

## How to Run Locally

Because the project uses ES Modules, it must be served over HTTP:

### Option 1: NPM Start (Python HTTP Server)
```sh
npm start
```
Visit **http://localhost:8000** in your web browser.

### Option 2: Python Directly
```sh
python -m http.server 8000 --directory dist
```

### Option 3: Node / npx
```sh
npx serve dist
```

### Option 4: Run Tests
```sh
npm test
```

## Portfolio Analysis (Baseline FX @ 96)

- **Baseline Resin Landed Cost**: $[ ( \$2.00 \times 96 ) + 10 ] \times 1.10 = \mathbf{₹222.20/\text{kg}}$
- **Post-Hike Landed Cost (+12%)**: $[ ( \$2.24 \times 96 ) + 10 ] \times 1.10 = \mathbf{₹247.544/\text{kg}}$ ($+₹25.344/\text{kg}$)

| Metric | Product A (Precision Housing) | Product B (Medical Connector) | Product C (Protective Cap) |
| :--- | :---: | :---: | :---: |
| **Selling Price (SP)** | **₹45.00** | **₹74.00** | **₹30.00** |
| Net Resin Qty (Gross with 5% scrap) | 0.10 kg (0.1053 kg) | **0.20 kg (0.2105 kg)** | 0.05 kg (0.0526 kg) |
| **Raw Resin Cost (Base → New)** | ₹23.39 → ₹26.06 | **₹46.78 → ₹52.11** | ₹11.70 → ₹13.03 |
| **Resin Cost Increase (Δ)** | **+₹2.67 (+11.41%)** | **+₹5.34 (+11.41%)** | **+₹1.33 (+11.41%)** |
| Non-Resin Conversion Costs | ₹15.00 | ₹24.00 | ₹12.00 |
| **Total Product Cost (Base → New)** | **₹38.39 → ₹41.06** | **₹70.78 → ₹76.11** | **₹23.70 → ₹25.03** |
| **Total Cost Increase (Δ)** | **+₹2.67 (+6.95%)** | **+₹5.34 (+7.54%)** | **+₹1.33 (+5.62%)** |
| **Resin Share of Total Cost** | 63.5% | **68.5% (High exposure)** | 52.1% |
| **Unit Profit / Loss** | +₹6.61 → +₹3.94 | **+₹3.22 → -₹2.11 (NET LOSS)** | +₹6.30 → +₹4.97 |
| **Gross Margin % (Base → New)** | 14.69% → 8.76% | **4.35% → -2.86%** | 21.02% → 16.57% |
| **Margin Variance (Δ Margin)** | -5.93% | <span style="color:red; font-weight:bold;">-7.21% (Collapsed)</span> | -4.45% |
| **Profitability Status** | Healthy | <span style="color:red; font-weight:bold;">LOSS-MAKING</span> | Healthy |
