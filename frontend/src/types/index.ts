// Core TypeScript types for CloudMart

export interface User {
  id: number
  email: string
  username: string
  first_name: string
  last_name: string
  full_name: string
  phone: string
  is_staff: boolean
  is_active: boolean
  created_at: string
}

export interface Address {
  id: number
  label: string
  full_name: string
  phone: string
  address_line1: string
  address_line2: string
  city: string
  state: string
  pincode: string
  country: string
  is_default: boolean
  created_at: string
}

export interface Category {
  id: number
  name: string
  slug: string
  description: string
  is_active: boolean
}

export interface ProductImage {
  id: number
  image: string
  alt_text: string
  is_primary: boolean
  sort_order: number
}

export interface Inventory {
  quantity: number
  reserved_quantity: number
  available_quantity: number
  low_stock_threshold: number
  is_low_stock: boolean
  is_in_stock: boolean
}

export interface ProductVariant {
  id: number
  sku: string
  price_paise: number
  original_price_paise: number | null
  price_inr: number
  discount_percent: number
  attributes: Record<string, string>
  is_active: boolean
  inventory: Inventory | null
  stock_quantity: number
  product_name?: string
  product_id?: number
  product_slug?: string
  product_image?: string | null
}

export interface Product {
  id: number
  name: string
  slug: string
  description: string
  category: number
  category_name: string
  is_active: boolean
  variants: ProductVariant[]
  images: ProductImage[]
  min_price: number | null
  primary_image: ProductImage | null
  created_at: string
  updated_at: string
}

export interface CartItem {
  id: number
  variant: ProductVariant & { product?: Product }
  quantity: number
  subtotal_paise: number
  added_at: string
}

export interface Cart {
  id: number
  items: CartItem[]
  total_paise: number
  item_count: number
  updated_at: string
}

export interface OrderItem {
  id: number
  variant: number
  product_name: string
  sku: string
  variant_attributes: Record<string, string>
  unit_price_paise: number
  quantity: number
  total_paise: number
}

export interface OrderStatusHistory {
  id: number
  from_status: string
  to_status: string
  payment_status: string
  notes: string
  changed_by_email: string
  created_at: string
}

export interface Order {
  id: number
  order_number: string
  customer: number
  customer_name: string
  customer_email: string
  customer_phone: string
  shipping_address_snapshot: Address
  subtotal_paise: number
  shipping_paise: number
  tax_paise: number
  discount_paise: number
  total_paise: number
  currency: string
  payment_method: 'COD' | 'UPI'
  payment_status: 'PENDING' | 'PAID' | 'COLLECTED' | 'FAILED' | 'REFUNDED' | 'CANCELLED'
  status: 'PLACED' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED' | 'RETURNED'
  tracking_number: string
  notes: string
  items: OrderItem[]
  status_history: OrderStatusHistory[]
  created_at: string
  updated_at: string
}

export interface DashboardMetrics {
  products: {
    total: number
    active: number
    low_stock: number
  }
  orders: {
    total: number
    pending: number
    confirmed: number
    delivered: number
    cancelled: number
    cod: number
    upi: number
  }
  revenue: {
    collected_paise: number
    pending_paise: number
  }
  recent_orders: Array<{
    id: number
    order_number: string
    customer_name: string
    customer_email: string
    total_paise: number
    payment_method: string
    payment_status: string
    status: string
    created_at: string
  }>
}

export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}
