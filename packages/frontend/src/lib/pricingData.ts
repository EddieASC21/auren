export const pricingData: Record<string, Record<string, any>> = {
  mens: {
    't-shirt': { base: 14.00 },
    'polo': { base: 22.00 },
    'hoodie': { base: 37.00 },
    'sweatshirt': { base: 37.00, discounts: { 50: 36.26, 75: 35.15, 100: 34.41, 150: 33.30, 500: 31.45 } },
    'quarter zip': { base: 37.00 },
    'long sleeve': { base: 16.00 },
    'vest': { base: 60.00, discounts: { 50: 55.00, 75: 50.00, 100: 45.00, 150: 44.10, 500: 41.90 } },
    'shorts': { base: 23.00 },
    'sports short': { base: 12.00 },
    'sports shirt': { base: 14.00 },
    'sweatpants': { base: 25.00 },
    'tank top': { base: 14.00 },
  },
  womens: {
    't-shirt': { base: 14.00 },
    'polo': { base: 22.00 },
    'sweatshirt': { base: 37.00, discounts: { 50: 36.26, 75: 35.15, 100: 34.41, 150: 33.30, 500: 31.45 } },
    'hoodie': { base: 37.00 },
    'quarter zip': { base: 37.00 },
    'long sleeve': { base: 16.00 },
    'vest': { base: 60.00, discounts: { 50: 55.00, 75: 50.00, 100: 45.00, 150: 44.10, 500: 41.90 } },
    'skirt': { base: 25.00 },
    'sweatshorts': { base: 23.00 },
    'sports bra': { base: 16.00 },
    'sports shirt': { base: 14.00 },
    'sports shorts': { base: 12.00 },
    'sweatpants': { base: 25.00 },
    'tank top': { base: 14.00 },
    'baby tee': { base: 14.00 },
    'spandex shorts': { base: 12.00 },
    // 'knit sweaters': { base: 50.00, discounts: { 50: 0.02, 75: 0.05, 100: 0.07, 150: 0.10, 500: 0.15 } },
  },
  others: {
    'backpack': { base: 25.00 },
    'baseball hat': { base: 17.00 },
    'beanie': { base: 18.00 },
    'bottle': { base: 16.00 },
    'notebook': { base: 5.00, discounts: { 50: 4.90, 75: 4.75, 100: 4.65, 150: 4.50, 500: 4.25 } },
    'tote bag': { base: 9.00 },
    'tumbler': { base: 16.00 },
    'tumbler bottle': { base: 16.00 },
    'mug': { base: 8.00 },
    'sock outer side': { base: 12.50, discounts: { 50: 12.25, 75: 11.88, 100: 11.63, 150: 11.25, 500: 10.63 } },
    'sock inner side': { base: 12.50, discounts: { 50: 12.25, 75: 11.88, 100: 11.63, 150: 11.25, 500: 10.63 } },
    'stationery': { base: 1.20, discounts: { 50: 1.18, 75: 1.14, 100: 1.12, 150: 1.08, 500: 1.02 } },
  },
};

export const getPriceDetails = (
  category: string,
  name: string,
  quantity: number,
  isCustom: boolean
): { unitPrice: number; totalCost: number } => {
  // 1. Handle Custom Pricing Override immediately
  if (isCustom) {
    const customPrice = 9.0; // Based on your UI text
    return {
      unitPrice: customPrice,
      totalCost: customPrice * quantity,
    };
  }

  const normalizedCategory = category.toLowerCase();
  const normalizedName = name.toLowerCase();

  // Map "other items" → "others"
  const categoryKey =
    normalizedCategory === 'other items' ? 'others' : normalizedCategory;

  // 2. Find the product data
  let product = pricingData[categoryKey]?.[normalizedName];

  // --- Aliases ---
  if (!product) {
    // socks
    if (normalizedName === 'sock outer' || normalizedName === 'sock inner') {
      product = pricingData.others['sock outer side'];
    }

    // pen should use stationery pricing
    if (normalizedName === 'pen') {
      product = pricingData.others['stationery'];
    }
  }

  // 3. If no product found, return 0 (Safe Fallback)
  if (!product) {
    return { unitPrice: 0, totalCost: 0 };
  }

  // 4. Calculate Discount
  let finalUnitPrice = product.base;

  if (product.discounts) {
    const thresholds = Object.keys(product.discounts)
      .map(Number)
      .sort((a, b) => b - a);

    const activeThreshold = thresholds.find((t) => quantity >= t);

    if (activeThreshold) {
      const discountValue = product.discounts[activeThreshold];

      if (discountValue < 1) {
        finalUnitPrice = product.base * (1 - discountValue);
      } else {
        finalUnitPrice = discountValue;
      }
    }
  }

  return {
    unitPrice: finalUnitPrice,
    totalCost: finalUnitPrice * quantity,
  };
};