// A 20-colour categorical palette for the (up to 20 default) country lines.
// Perfect distinctness across 20 hues on a light ground is impossible; the
// search box, legend, and isolate-on-click disambiguate where colours are close.
// Colours are assigned by each team's all-time rank, so a team keeps the same
// colour regardless of what else is selected.
const PALETTE = [
  '#d8a200', // gold (Brazil, rank 0)
  '#3b6fb0', // blue
  '#e4572e', // vermilion
  '#2e8b57', // sea green
  '#9b59b6', // purple
  '#17a2b8', // teal
  '#e8869b', // pink
  '#f39c12', // orange
  '#5d6d9c', // slate
  '#c0392b', // brick
  '#27ae60', // green
  '#8e44ad', // violet
  '#2980b9', // strong blue
  '#d35400', // pumpkin
  '#16a085', // dark teal
  '#7f8c8d', // grey
  '#b7950b', // dark gold
  '#cb6ce6', // lilac
  '#1f8a70', // pine
  '#a0522d', // sienna
]

export function colorFor(index: number): string {
  return PALETTE[((index % PALETTE.length) + PALETTE.length) % PALETTE.length]
}
