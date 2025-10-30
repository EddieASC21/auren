export const pricingData: Record<string, Record<string, any>> = {
  mens: {
    't-shirt': { base: 14.00 },
    'polo': { base: 22.00 },
    'sweatshirt': { base: 37.00, discounts: { 50: 0.02, 75: 0.05, 100: 0.07, 150: 0.10, 500: 0.15 } },
    'hoodie': { base: 37.00 },
    'quarter zip': { base: 37.00 },
    'long sleeve': { base: 16.00 },
    'vest': { base: 60.00, discounts: { 35: 55.00, 50: 50.00, 75: 45.00, 100: 0.02, 150: 0.05 } }, // NOTE: Mixed absolute and percentage discounts
    'shorts': { base: 23.00 },
    'sports short': { base: 12.00 },
    'sports shirt': { base: 14.00 },
    'sweatpants': { base: 25.00 },
    'tank top': { base: 14.00 },
  },
  womens: {
    't-shirt': { base: 14.00 },
    'polo': { base: 22.00 },
    'sweatshirt': { base: 37.00 },
    'hoodie': { base: 37.00 },
    'quarter zip': { base: 37.00 },
    'long sleeve': { base: 16.00 },
    'vest': { base: 60.00, discounts: { 35: 55.00, 50: 50.00, 75: 45.00, 100: 0.02, 150: 0.05 } },
    'skirt': { base: 25.00 },
    'sweatshorts': { base: 23.00 },
    'sports bra': { base: 16.00 },
    'sports shirt': { base: 14.00 },
    'sports shorts': { base: 12.00 },
    'sweatpants': { base: 25.00 },
    'tank top': { base: 14.00 },
    'knit sweaters': { base: 50.00, discounts: { 50: 0.02, 75: 0.05, 100: 0.07, 150: 0.10, 500: 0.15 } },
  },
  others: {
    'backpack': { base: 25.00 },
    'baseball hat': { base: 17.00 },
    'beanie': { base: 18.00 },
    'bottle': { base: 16.00 },
    'notebook': { base: 5.00, discounts: { 50: 0.02, 75: 0.05, 100: 0.07, 150: 0.10, 500: 0.15 } },
    'tote bag': { base: 9.00 },
    'tumbler': { base: 16.00 },
    'tumbler bottle': { base: 16.00 },
    'mug': { base: 8.00 },
    'sock outer side': { base: 12.50, discounts: { 50: 0.02, 75: 0.05, 100: 0.07, 150: 0.10, 500: 0.15 } },
    'sock inner side': { base: 12.50, discounts: { 50: 0.02, 75: 0.05, 100: 0.07, 150: 0.10, 500: 0.15 } },
    'stationery': { base: 1.20, discounts: { 50: 0.02, 75: 0.05, 100: 0.07, 150: 0.10, 500: 0.15 } },
  },
};

export const getPriceDetails = (category: string, name: string): { base: number; discounts?: any } | null => {
  const normalizedCategory = category.toLowerCase();
  const normalizedName = name.toLowerCase();

  const product = pricingData[normalizedCategory]?.[normalizedName];

  if (product) {
    return product;
  }
  
  // Handling special cases for names that might not match directly
  if (normalizedName === 'sock outer' || normalizedName === 'sock inner') {
    return pricingData.others['sock outer side'];
  }

  return null;
};
