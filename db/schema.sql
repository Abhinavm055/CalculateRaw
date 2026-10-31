-- Materials Master
CREATE TABLE IF NOT EXISTS materials (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD',
  base_price NUMERIC(10,4) NOT NULL
);

-- Material Price & Landed Cost History
CREATE TABLE IF NOT EXISTS price_history (
  id SERIAL PRIMARY KEY,
  material_code VARCHAR(50) REFERENCES materials(code) ON DELETE CASCADE,
  effective_date DATE NOT NULL,
  price_usd NUMERIC(10,4) NOT NULL,
  fx_rate NUMERIC(10,4) NOT NULL DEFAULT 96.0,
  freight_inr NUMERIC(10,4) NOT NULL DEFAULT 10.0,
  duty_pct NUMERIC(5,2) NOT NULL DEFAULT 10.0,
  landed_cost_inr NUMERIC(10,4) NOT NULL,
  is_hike BOOLEAN DEFAULT FALSE,
  notes TEXT
);

-- Finished Products & BOM Master
CREATE TABLE IF NOT EXISTS products (
  id VARCHAR(10) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  selling_price NUMERIC(10,2) NOT NULL,
  net_resin_qty NUMERIC(10,4) NOT NULL,
  scrap_pct NUMERIC(5,2) NOT NULL DEFAULT 5.0,
  other_materials_inr NUMERIC(10,2) NOT NULL DEFAULT 0.0,
  labour_inr NUMERIC(10,2) NOT NULL DEFAULT 0.0,
  machine_inr NUMERIC(10,2) NOT NULL DEFAULT 0.0,
  packaging_inr NUMERIC(10,2) NOT NULL DEFAULT 0.0,
  sterilisation_inr NUMERIC(10,2) NOT NULL DEFAULT 0.0
);

-- Inventory Batches Register
CREATE TABLE IF NOT EXISTS inventory_batches (
  id SERIAL PRIMARY KEY,
  batch_code VARCHAR(50) UNIQUE NOT NULL,
  material_code VARCHAR(50) REFERENCES materials(code) ON DELETE CASCADE,
  receipt_date DATE NOT NULL,
  initial_qty NUMERIC(10,2) NOT NULL,
  available_qty NUMERIC(10,2) NOT NULL,
  unit_landed_cost NUMERIC(10,4) NOT NULL,
  silo_location VARCHAR(50),
  status VARCHAR(50)
);

-- FIFO Issue Transactions Log
CREATE TABLE IF NOT EXISTS fifo_issues (
  id SERIAL PRIMARY KEY,
  issue_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  material_code VARCHAR(50) NOT NULL,
  requested_qty NUMERIC(10,2) NOT NULL,
  total_cost NUMERIC(10,2) NOT NULL,
  blended_rate NUMERIC(10,4) NOT NULL,
  savings NUMERIC(10,2) NOT NULL,
  allocation_details JSONB NOT NULL
);
