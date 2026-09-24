-- 0029: durable server-side carts for guest and authenticated checkout.
-- Cart data is Hono/service-role only; clients receive server-rendered projections.

CREATE TABLE IF NOT EXISTS carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles (id) ON DELETE CASCADE,
  guest_token_hash text,
  status text NOT NULL DEFAULT 'ACTIVE',
  version integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT carts_owner_check CHECK (num_nonnulls(user_id, guest_token_hash) = 1),
  CONSTRAINT carts_status_check CHECK (status IN ('ACTIVE', 'CHECKOUT_PENDING', 'CONVERTED', 'ABANDONED'))
);

CREATE UNIQUE INDEX IF NOT EXISTS carts_user_active_uq
  ON carts (user_id)
  WHERE user_id IS NOT NULL AND status IN ('ACTIVE', 'CHECKOUT_PENDING');
CREATE UNIQUE INDEX IF NOT EXISTS carts_guest_active_uq
  ON carts (guest_token_hash)
  WHERE guest_token_hash IS NOT NULL AND status IN ('ACTIVE', 'CHECKOUT_PENDING');
CREATE INDEX IF NOT EXISTS carts_expiry_idx ON carts (expires_at);

CREATE TABLE IF NOT EXISTS cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id uuid NOT NULL REFERENCES carts (id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES product_variants (id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1,
  unit_price_snapshot integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cart_items_quantity_check CHECK (quantity > 0),
  CONSTRAINT cart_items_cart_variant_uq UNIQUE (cart_id, variant_id)
);

CREATE INDEX IF NOT EXISTS cart_items_cart_idx ON cart_items (cart_id);

ALTER TABLE carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON carts FROM anon, authenticated;
REVOKE ALL ON cart_items FROM anon, authenticated;
