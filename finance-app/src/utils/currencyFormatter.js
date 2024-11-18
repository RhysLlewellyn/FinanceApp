export const formatCurrency = (value, currencyCode = 'GBP') => {
  if (typeof value !== 'number' || isNaN(value)) {
    console.warn(`Invalid currency value: ${value}`);
    return '0.00';
  }

  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currencyCode || 'GBP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch (error) {
    console.error(`Error formatting currency: ${error}`);
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }
};
