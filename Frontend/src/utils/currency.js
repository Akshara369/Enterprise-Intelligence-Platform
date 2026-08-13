export const formatCurrency = (value) => (
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  }).format(value || 0)
);

export const formatCompactCurrency = (value) => {
  const amount = Number(value || 0);
  if (Math.abs(amount) >= 1000) {
    return `₹${(amount / 1000).toFixed(0)}k`;
  }
  return `₹${amount.toFixed(0)}`;
};
