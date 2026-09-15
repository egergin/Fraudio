export function niceCeil(v) {
  if (!Number.isFinite(v) || v <= 0) return 5;
  const mag = 10 ** Math.floor(Math.log10(v));
  const n = v / mag;
  const step = n <= 1 ? 1 : n <= 1.5 ? 1.5 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 4 ? 4 : n <= 5 ? 5 : 10;
  return step * mag;
}

export function countYScale(dataMax) {
  return {
    beginAtZero: true,
    max: niceCeil(dataMax),
    ticks: { maxTicksLimit: 6, precision: 0 },
  };
}

export function amountYScale(dataMax, tickLabel) {
  return {
    beginAtZero: true,
    max: niceCeil(dataMax),
    ticks: { maxTicksLimit: 6, callback: (v) => tickLabel(v) },
  };
}
