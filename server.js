import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { query } from './db/db.js';
import {
  landed,
  grossResin,
  conversionCost,
  resinCost,
  cost,
  profit,
  margin,
  fifo
} from './dist/costing.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static frontend from dist
app.use(express.static(path.join(__dirname, 'dist')));

// 1. Health & Database Check API
app.get('/api/health', async (req, res) => {
  try {
    const dbRes = await query('SELECT NOW() as db_time');
    res.json({
      status: 'ok',
      service: 'CalculateRaw Manufacturing API',
      database: 'Neon PostgreSQL Connected',
      server_time: new Date().toISOString(),
      db_time: dbRes.rows[0].db_time
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// 2. Products Master API
app.get('/api/products', async (req, res) => {
  try {
    const result = await query('SELECT * FROM products ORDER BY id ASC');
    const formatted = result.rows.map(r => ({
      id: r.id,
      name: r.name,
      sp: Number(r.selling_price),
      qty: Number(r.net_resin_qty),
      scrap: Number(r.scrap_pct),
      other: Number(r.other_materials_inr),
      labour: Number(r.labour_inr),
      machine: Number(r.machine_inr),
      packaging: Number(r.packaging_inr),
      sterilisation: Number(r.sterilisation_inr)
    }));
    res.json({ success: true, count: formatted.length, data: formatted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update Product BOM/Selling Price
app.put('/api/products/:id', async (req, res) => {
  const { id } = req.params;
  const { sp, qty, scrap, other, labour, machine, packaging, sterilisation } = req.body;
  try {
    const updateRes = await query(`
      UPDATE products
      SET
        selling_price = COALESCE($1, selling_price),
        net_resin_qty = COALESCE($2, net_resin_qty),
        scrap_pct = COALESCE($3, scrap_pct),
        other_materials_inr = COALESCE($4, other_materials_inr),
        labour_inr = COALESCE($5, labour_inr),
        machine_inr = COALESCE($6, machine_inr),
        packaging_inr = COALESCE($7, packaging_inr),
        sterilisation_inr = COALESCE($8, sterilisation_inr)
      WHERE id = $9
      RETURNING *;
    `, [sp, qty, scrap, other, labour, machine, packaging, sterilisation, id]);

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.json({ success: true, data: updateRes.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Price History API
app.get('/api/price-history', async (req, res) => {
  try {
    const result = await query(`
      SELECT p.*, m.name as material_name
      FROM price_history p
      JOIN materials m ON p.material_code = m.code
      ORDER BY p.effective_date ASC;
    `);
    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Live Costing & Margin Analysis Engine API
app.post('/api/costing/calculate', async (req, res) => {
  try {
    const {
      costingDate = '2026-11-01',
      fx = 96.0,
      freight = 10.0,
      duty = 10.0,
      effectiveDate = '2026-11-01'
    } = req.body;

    // Check if hike is active
    const isPostHike = costingDate >= effectiveDate;
    const supplierUSD = isPostHike ? 2.00 * 1.12 : 2.00;

    // Landed costs
    const baseLandedRate = landed(2.00, fx, freight, duty);
    const scenarioLandedRate = landed(supplierUSD, fx, freight, duty);
    const landedDelta = scenarioLandedRate - baseLandedRate;
    const landedDeltaPct = (landedDelta / baseLandedRate) * 100;

    // Fetch products from database
    const dbProducts = await query('SELECT * FROM products ORDER BY id ASC');
    const productsList = dbProducts.rows.map(r => ({
      id: r.id,
      name: r.name,
      sp: Number(r.selling_price),
      qty: Number(r.net_resin_qty),
      scrap: Number(r.scrap_pct),
      other: Number(r.other_materials_inr),
      labour: Number(r.labour_inr),
      machine: Number(r.machine_inr),
      packaging: Number(r.packaging_inr),
      sterilisation: Number(r.sterilisation_inr)
    }));

    // Perform real-time product calculations
    const analysis = productsList.map(p => {
      const gross = grossResin(p);
      const conv = p.other + conversionCost(p);

      const baseResinCost = gross * baseLandedRate;
      const currResinCost = gross * scenarioLandedRate;
      const resinCostDelta = currResinCost - baseResinCost;
      const resinCostDeltaPct = (resinCostDelta / baseResinCost) * 100;

      const baseTotalCost = baseResinCost + conv;
      const currTotalCost = currResinCost + conv;
      const totalCostDelta = currTotalCost - baseTotalCost;
      const totalCostDeltaPct = (totalCostDelta / baseTotalCost) * 100;

      const resinSharePct = (currResinCost / currTotalCost) * 100;

      const baseProfit = p.sp - baseTotalCost;
      const baseMargin = (baseProfit / p.sp) * 100;
      const currProfit = p.sp - currTotalCost;
      const currMargin = (currProfit / p.sp) * 100;
      const marginDelta = currMargin - baseMargin;
      const isLossMaking = currProfit < 0;

      return {
        id: p.id,
        name: p.name,
        sellingPrice: p.sp,
        netResinQty: p.qty,
        scrapPct: p.scrap,
        grossResinQty: Number(gross.toFixed(6)),
        conversionOverheads: conv,
        resinCost: {
          baseline: Number(baseResinCost.toFixed(2)),
          current: Number(currResinCost.toFixed(2)),
          delta: Number(resinCostDelta.toFixed(2)),
          deltaPct: Number(resinCostDeltaPct.toFixed(2))
        },
        totalCost: {
          baseline: Number(baseTotalCost.toFixed(2)),
          current: Number(currTotalCost.toFixed(2)),
          delta: Number(totalCostDelta.toFixed(2)),
          deltaPct: Number(totalCostDeltaPct.toFixed(2))
        },
        resinShareOfTotalCostPct: Number(resinSharePct.toFixed(2)),
        profitability: {
          baselineProfit: Number(baseProfit.toFixed(2)),
          currentProfit: Number(currProfit.toFixed(2)),
          baselineMarginPct: Number(baseMargin.toFixed(2)),
          currentMarginPct: Number(currMargin.toFixed(2)),
          marginDeltaPct: Number(marginDelta.toFixed(2)),
          status: isLossMaking ? 'LOSS-MAKING' : currMargin < 10 ? 'LOW-MARGIN' : 'HEALTHY'
        }
      };
    });

    const lossMakingProducts = analysis.filter(a => a.profitability.currentProfit < 0);

    res.json({
      success: true,
      parameters: {
        costingDate,
        effectiveDate,
        fx,
        freight,
        duty,
        isPostHike,
        supplierUSD
      },
      landedCost: {
        baselineRate: Number(baseLandedRate.toFixed(4)),
        currentRate: Number(scenarioLandedRate.toFixed(4)),
        deltaRate: Number(landedDelta.toFixed(4)),
        deltaPct: Number(landedDeltaPct.toFixed(2))
      },
      portfolioSummary: {
        productsTracked: analysis.length,
        averageMarginPct: Number((analysis.reduce((s, a) => s + a.profitability.currentMarginPct, 0) / analysis.length).toFixed(2)),
        averageCostDelta: Number((analysis.reduce((s, a) => s + a.totalCost.delta, 0) / analysis.length).toFixed(2)),
        lossMakingCount: lossMakingProducts.length,
        criticalAlert: lossMakingProducts.length > 0
          ? `${lossMakingProducts.map(p => p.name).join(', ')} turns into a loss-making product under current resin prices.`
          : 'All products remain profitable.'
      },
      products: analysis
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Inventory Batches API
app.get('/api/inventory/batches', async (req, res) => {
  try {
    const batches = await query('SELECT * FROM inventory_batches ORDER BY receipt_date ASC');
    res.json({ success: true, data: batches.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Interactive Product FIFO Demo Allocation API (Calculated on Backend)
app.post('/api/inventory/fifo-product-demo', async (req, res) => {
  try {
    const {
      units = 500,
      productId = 'B',
      costingDate = '2026-11-01',
      effectiveDate = '2026-11-01',
      fx = 96.0,
      freight = 10.0,
      duty = 10.0
    } = req.body;

    const u = Number(units);
    if (!Number.isFinite(u) || u <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid production units.' });
    }

    // Retrieve Product from Database
    const prodRes = await query('SELECT * FROM products WHERE id = $1', [productId]);
    if (prodRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    const r = prodRes.rows[0];
    const p = {
      id: r.id,
      name: r.name,
      sp: Number(r.selling_price),
      qty: Number(r.net_resin_qty),
      scrap: Number(r.scrap_pct),
      other: Number(r.other_materials_inr),
      labour: Number(r.labour_inr),
      machine: Number(r.machine_inr),
      packaging: Number(r.packaging_inr),
      sterilisation: Number(r.sterilisation_inr)
    };

    const grossPerUnit = grossResin(p);
    const convPerUnit = p.other + conversionCost(p);
    const reqResin = u * grossPerUnit;

    // Check price hike status
    const isPostHike = costingDate >= effectiveDate;
    const supplierUSD = isPostHike ? 2.00 * 1.12 : 2.00;
    const scenarioLandedRate = landed(supplierUSD, fx, freight, duty);
    const baselineLandedRate = landed(2.00, fx, freight, duty);

    // Fetch batches from Database
    const batchesRes = await query('SELECT * FROM inventory_batches ORDER BY receipt_date ASC');
    const oldBatchRow = batchesRes.rows[0] || { available_qty: 100, unit_landed_cost: baselineLandedRate };
    const freshBatchRow = batchesRes.rows[1] || { available_qty: 200, unit_landed_cost: scenarioLandedRate };

    const oldAvailable = Number(oldBatchRow.available_qty);
    const freshAvailable = isPostHike ? Number(freshBatchRow.available_qty) : 0;
    const totalAvailable = oldAvailable + freshAvailable;

    if (reqResin > totalAvailable) {
      return res.status(400).json({
        success: false,
        message: `${u} units require ${reqResin.toFixed(2)} kg resin, exceeding available stock (${totalAvailable} kg) on ${costingDate}.`
      });
    }

    // FIFO Allocation Math on Backend
    const oldDrawn = Math.min(reqResin, oldAvailable);
    const freshDrawn = Math.max(0, reqResin - oldDrawn);
    const oldCostTotal = oldDrawn * Number(oldBatchRow.unit_landed_cost);
    const freshCostTotal = freshDrawn * scenarioLandedRate;
    const totalMaterialCost = oldCostTotal + freshCostTotal;

    const blendedRatePerKg = reqResin > 0 ? totalMaterialCost / reqResin : 0;
    const blendedResinPerUnit = totalMaterialCost / u;
    const totalCostPerUnit = blendedResinPerUnit + convPerUnit;
    const profitPerUnit = p.sp - totalCostPerUnit;
    const marginPct = (profitPerUnit / p.sp) * 100;

    // What-if replacement cost (if made 100% at new price)
    const replacementResinCost = reqResin * scenarioLandedRate;
    const savings = replacementResinCost - totalMaterialCost;
    const replacementUnitCost = (replacementResinCost / u) + convPerUnit;
    const replacementProfit = p.sp - replacementUnitCost;
    const replacementMarginPct = (replacementProfit / p.sp) * 100;

    res.json({
      success: true,
      data: {
        product: {
          id: p.id,
          name: p.name,
          sellingPrice: p.sp,
          netResinPerUnit: p.qty,
          scrapPct: p.scrap,
          grossResinPerUnit: Number(grossPerUnit.toFixed(6)),
          conversionPerUnit: convPerUnit
        },
        productionRun: {
          units: u,
          grossResinRequired: Number(reqResin.toFixed(4)),
          totalMaterialCost: Number(totalMaterialCost.toFixed(2)),
          blendedRatePerKg: Number(blendedRatePerKg.toFixed(4)),
          blendedResinPerUnit: Number(blendedResinPerUnit.toFixed(2)),
          totalCostPerUnit: Number(totalCostPerUnit.toFixed(2)),
          profitPerUnit: Number(profitPerUnit.toFixed(2)),
          marginPct: Number(marginPct.toFixed(2)),
          isLossMaking: profitPerUnit < 0
        },
        fifoBreakdown: {
          oldBatch: {
            code: oldBatchRow.batch_code || 'PP-BATCH-001',
            rate: Number(oldBatchRow.unit_landed_cost),
            drawn: Number(oldDrawn.toFixed(2)),
            cost: Number(oldCostTotal.toFixed(2)),
            exhausted: oldDrawn >= oldAvailable,
            remaining: Number((oldAvailable - oldDrawn).toFixed(2))
          },
          newBatch: {
            code: freshBatchRow.batch_code || 'PP-BATCH-002',
            rate: Number(scenarioLandedRate.toFixed(4)),
            drawn: Number(freshDrawn.toFixed(2)),
            cost: Number(freshCostTotal.toFixed(2)),
            remaining: Number((freshAvailable - freshDrawn).toFixed(2))
          }
        },
        comparisonVsReplacement: {
          savingsPreserved: Number(savings.toFixed(2)),
          replacementUnitCost: Number(replacementUnitCost.toFixed(2)),
          replacementProfit: Number(replacementProfit.toFixed(2)),
          replacementMarginPct: Number(replacementMarginPct.toFixed(2))
        }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Interactive FIFO Issue Allocation API
app.post('/api/inventory/fifo-issue', async (req, res) => {
  try {
    const { quantity = 120, rate = 247.544, recordTransaction = false } = req.body;
    const q = Number(quantity);

    const batches = await query('SELECT * FROM inventory_batches ORDER BY receipt_date ASC');
    const oldBatch = batches.rows[0] || { available_qty: 100, unit_landed_cost: 222.20 };
    const freshBatch = batches.rows[1] || { available_qty: 200, unit_landed_cost: 247.544 };

    const oldAvailable = Number(oldBatch.available_qty);
    const freshAvailable = Number(freshBatch.available_qty);
    const maxAvailable = oldAvailable + freshAvailable;

    if (q < 0 || q > maxAvailable) {
      return res.status(400).json({
        success: false,
        message: `Requested ${q} kg exceeds available inventory (${maxAvailable} kg).`
      });
    }

    const oldDrawn = Math.min(q, oldAvailable);
    const freshDrawn = Math.max(0, q - oldDrawn);
    const oldCost = oldDrawn * Number(oldBatch.unit_landed_cost);
    const freshCost = freshDrawn * Number(rate || freshBatch.unit_landed_cost);
    const totalCost = oldCost + freshCost;
    const blendedRate = q > 0 ? totalCost / q : 0;
    const savings = oldDrawn * (Number(rate) - Number(oldBatch.unit_landed_cost));

    const result = {
      requestedQty: q,
      totalCost: Number(totalCost.toFixed(2)),
      blendedRate: Number(blendedRate.toFixed(4)),
      savingsVsReplacement: Number(savings.toFixed(2)),
      allocation: [
        {
          batchCode: oldBatch.batch_code || 'PP-BATCH-001',
          receiptDate: oldBatch.receipt_date,
          unitCost: Number(oldBatch.unit_landed_cost),
          openingStock: oldAvailable,
          drawn: Number(oldDrawn.toFixed(2)),
          remainingStock: Number((oldAvailable - oldDrawn).toFixed(2)),
          issueCost: Number(oldCost.toFixed(2))
        },
        {
          batchCode: freshBatch.batch_code || 'PP-BATCH-002',
          receiptDate: freshBatch.receipt_date,
          unitCost: Number(rate),
          openingStock: freshAvailable,
          drawn: Number(freshDrawn.toFixed(2)),
          remainingStock: Number((freshAvailable - freshDrawn).toFixed(2)),
          issueCost: Number(freshCost.toFixed(2))
        }
      ]
    };

    if (recordTransaction) {
      await query(`
        INSERT INTO fifo_issues
          (material_code, requested_qty, total_cost, blended_rate, savings, allocation_details)
        VALUES ('PP-RESIN', $1, $2, $3, $4, $5);
      `, [q, totalCost, blendedRate, savings, JSON.stringify(result.allocation)]);
    }

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Fallback to index.html for client-side routing
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 CalculateRaw Full-Stack Server running at http://localhost:${PORT}`);
  console.log(`📡 Connected to Neon PostgreSQL Database`);
});
