/**
 * Item tax in whole pennies.
 * `1099 * 0.2` is 219.8, which rounds to 220.
 */
export function itemTaxInPennies(cost: number, taxRate: number): number {
  return Math.round(cost * taxRate);
}
