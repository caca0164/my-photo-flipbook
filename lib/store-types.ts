export type StoreProductKind = "physical_album" | "e_album" | "framed_print";

export type StoreOrderStatus =
  | "pending_payment"
  | "paid"
  | "processing"
  | "shipped"
  | "cancelled";

export type StoreProductRow = {
  id: string;
  slug: string;
  product_kind: StoreProductKind;
  title_en: string;
  title_zh: string;
  description_en: string;
  description_zh: string;
  price_cents: number;
  currency: string;
  image_url: string | null;
  active: boolean;
  sort_order: number;
};

export type CartLine = { productId: string; quantity: number };

export type StoreOrderListRow = {
  id: string;
  customer_email: string;
  customer_name: string;
  status: StoreOrderStatus;
  total_cents: number;
  currency: string;
  created_at: string;
};

export type StoreAdminOrderBundle = {
  order: StoreOrderListRow;
  items: unknown[];
};
