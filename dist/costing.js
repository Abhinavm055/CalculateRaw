export const baseline = 222.2; // Baseline landed cost with USD @ 96, freight 10, duty 10%: ($2.00 * 96 + 10) * 1.10 = 222.2

export const products = [
  { id: 'A', name: 'Precision housing', qty: 0.1, scrap: 5, other: 5, labour: 4, machine: 3, packaging: 2, sterilisation: 1, sp: 45 },
  { id: 'B', name: 'Medical connector', qty: 0.2, scrap: 5, other: 8, labour: 6, machine: 5, packaging: 3, sterilisation: 2, sp: 74 },
  { id: 'C', name: 'Protective cap', qty: 0.05, scrap: 5, other: 4, labour: 3, machine: 2, packaging: 2, sterilisation: 1, sp: 30 }
];

export function landed(price, fx, freight, duty) {
  return (price * fx + freight) * (1 + duty / 100);
}

export function grossResin(p) {
  return p.qty / (1 - p.scrap / 100);
}

export function conversionCost(p) {
  return p.labour + p.machine + p.packaging + p.sterilisation;
}

export function resinCost(p, rate) {
  return grossResin(p) * rate;
}

export function cost(p, rate) {
  return resinCost(p, rate) + p.other + conversionCost(p);
}

export function profit(p, rate) {
  return p.sp - cost(p, rate);
}

export function margin(p, rate) {
  return (profit(p, rate) / p.sp) * 100;
}

export function fifo(quantity, rate, oldStock = 100, freshStock = 200) {
  const maxAvailable = oldStock + freshStock;
  if (quantity < 0 || quantity > maxAvailable) {
    throw Error(`Enter 0–${maxAvailable} kg: available stock is ${maxAvailable} kg.`);
  }
  const old = Math.min(quantity, oldStock);
  const fresh = Math.max(0, quantity - old);
  const total = old * baseline + fresh * rate;
  const savings = old * (rate - baseline);
  return {
    old,
    fresh,
    remainingOld: oldStock - old,
    remainingFresh: freshStock - fresh,
    total,
    blended: quantity > 0 ? total / quantity : 0,
    savings: Math.max(0, savings)
  };
}
