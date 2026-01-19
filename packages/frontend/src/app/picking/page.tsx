// packages/frontend/src/app/picking/page.tsx

import { ALL_PRODUCTS_BASE } from '../../lib/products-data'
import PickPageClient from './PickPageClient'

/**
 * Backend pricing categories are: "mens" | "womens" | "others"
 * Your UI sometimes uses "other items" or other display names.
 */
function normalizePricingCategory(category: string) {
  const c = (category || '').toLowerCase().trim()

  if (!c) return ''

  if (c === 'other items') return 'others'
  if (c.includes('women')) return 'womens'
  if (c.includes('men')) return 'mens'
  if (c.includes('other')) return 'others'

  return c
}

/**
 * Backend pricing names are lowercased keys like:
 * "t-shirt", "quarter zip", "baseball hat", "sock"
 */
function normalizePricingName(name: string, categoryKey?: string) {
  let key = (name || '').toLowerCase().trim()
  if (!key) return ''

  key = key.replace(/\s+/g, ' ').trim()
  key = key.replace(/–|—/g, '-')

  // common aliases
  if (key === 't shirt' || key === 'tshirt' || key === 'tee' || key === 'tee shirt') {
    key = 't-shirt'
  }

  if (key === 'quarterzip' || key === 'quarter-zip') {
    key = 'quarter zip'
  }

  if (key === 'longsleeve' || key === 'long-sleeve') {
    key = 'long sleeve'
  }

  if (key === 'baseballhat' || key === 'baseball-hat') {
    key = 'baseball hat'
  }

  if (key === 'totebag' || key === 'tote-bag' || key === 'tote') {
    key = 'tote bag'
  }

  if (key === 'tumblerbottle' || key === 'tumbler-bottle') {
    key = 'tumbler bottle'
  }

  // socks / pen aliasing (mirrors backend)
  if (
    key === 'sock outer' ||
    key === 'sock inner' ||
    key === 'sock outer side' ||
    key === 'sock inner side'
  ) {
    key = 'sock'
  }
  if (key === 'pen') key = 'stationery'

  // womens vs mens naming mismatch protection
  if (categoryKey === 'womens' && key === 'sports short') key = 'sports shorts'
  if (categoryKey === 'mens' && key === 'sports shorts') key = 'sports short'

  return key
}

function derivePricingKeys(args: { productCategory?: string; productName?: string }) {
  const category = normalizePricingCategory(args.productCategory || '')
  const name = normalizePricingName(args.productName || '', category)
  return { category, name }
}

export default async function PickPage() {
  const productsWithPricingKeys = ALL_PRODUCTS_BASE.map((p) => {
    const { category, name } = derivePricingKeys({
      productCategory: p.category,
      productName: p.name,
    })

    return {
      ...p,
      price: null,
      pricingCategory: category,
      pricingName: name,
    }
  })

  return <PickPageClient initialProducts={productsWithPricingKeys} />
}
