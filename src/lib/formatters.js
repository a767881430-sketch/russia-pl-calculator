const rubFormatter = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

const rubCompactFormatter = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  notation: "compact",
  maximumFractionDigits: 1,
});

const cnyFormatter = new Intl.NumberFormat("zh-CN", {
  style: "currency",
  currency: "CNY",
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat("zh-CN", {
  style: "percent",
  maximumFractionDigits: 1,
});

export function formatRub(value) {
  return rubFormatter.format(Number(value || 0));
}

export function formatRubCompact(value) {
  return rubCompactFormatter.format(Number(value || 0));
}

export function formatCny(value) {
  return cnyFormatter.format(Number(value || 0));
}

export function formatPercent(value) {
  return percentFormatter.format(Number(value || 0));
}

export function formatDateTime(value) {
  if (!value) return "未记录";
  try {
    return new Date(value).toLocaleString("zh-CN");
  } catch {
    return String(value);
  }
}
