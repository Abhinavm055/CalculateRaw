import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool, query } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function seed() {
  console.log('🌱 Starting Neon PostgreSQL database migration and seed...');

  try {
    // 1. Run Schema
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await query(schemaSql);
    console.log('✅ Tables created/verified in Neon.');

    // 2. Seed Materials
    await query(`
      INSERT INTO materials (code, name, currency, base_price)
      VALUES ('PP-RESIN', 'Polypropylene Polymer Resin (Imported)', 'USD', 2.0000)
      ON CONFLICT (code) DO UPDATE
      SET name = EXCLUDED.name, base_price = EXCLUDED.base_price;
    `);

    // 3. Seed Price History
    await query(`DELETE FROM price_history;`);
    await query(`
      INSERT INTO price_history
        (material_code, effective_date, price_usd, fx_rate, freight_inr, duty_pct, landed_cost_inr, is_hike, notes)
      VALUES
        ('PP-RESIN', '2026-10-01', 2.0000, 96.0, 10.0, 10.0, 222.2000, FALSE, 'Baseline contract price @ ₹96/USD'),
        ('PP-RESIN', '2026-11-01', 2.2400, 96.0, 10.0, 10.0, 247.5440, TRUE, 'Supplier +12% price hike effective 01-Nov-2026');
    `);

    // 4. Seed Products
    await query(`DELETE FROM products;`);
    await query(`
      INSERT INTO products
        (id, name, selling_price, net_resin_qty, scrap_pct, other_materials_inr, labour_inr, machine_inr, packaging_inr, sterilisation_inr)
      VALUES
        ('A', 'Precision housing', 45.00, 0.1000, 5.0, 5.00, 4.00, 3.00, 2.00, 1.00),
        ('B', 'Medical connector', 74.00, 0.2000, 5.0, 8.00, 6.00, 5.00, 3.00, 2.00),
        ('C', 'Protective cap', 30.00, 0.0500, 5.0, 4.00, 3.00, 2.00, 2.00, 1.00);
    `);

    // 5. Seed Inventory Batches
    await query(`DELETE FROM inventory_batches;`);
    await query(`
      INSERT INTO inventory_batches
        (batch_code, material_code, receipt_date, initial_qty, available_qty, unit_landed_cost, silo_location, status)
      VALUES
        ('PP-BATCH-001', 'PP-RESIN', '2026-10-20', 100.00, 100.00, 222.2000, 'Silo A (Main Warehouse)', 'Existing Pre-Hike Stock'),
        ('PP-BATCH-002', 'PP-RESIN', '2026-11-01', 200.00, 200.00, 247.5440, 'Silo B (Port Inbound)', 'Post-Hike Scenario Stock');
    `);

    console.log('✅ Seed data successfully inserted into Neon PostgreSQL!');
  } catch (err) {
    console.error('❌ Error during seed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
