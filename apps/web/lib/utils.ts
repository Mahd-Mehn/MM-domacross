export function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(' ');
}

export function formatNumber(num: number, opts: Intl.NumberFormatOptions = {}) {
  return new Intl.NumberFormat('en-US', {maximumFractionDigits: 2, ...opts}).format(num);
}
