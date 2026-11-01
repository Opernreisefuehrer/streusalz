export const schema = `
CREATE SEQUENCE IF NOT EXISTS order_numbers;
CREATE SEQUENCE IF NOT EXISTS invoice_numbers;
CREATE SEQUENCE IF NOT EXISTS delivery_numbers;
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY,
  number text UNIQUE NOT NULL,
  request_id uuid UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL CHECK (status IN ('ordered','supplier_confirmed','invoiced','delivered')),
  snapshot jsonb NOT NULL,
  supplier_reference text,
  delivered_dates jsonb
);
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES orders(id),
  participant_index integer NOT NULL,
  kind text NOT NULL CHECK (kind IN ('invoice','delivery')),
  number text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  snapshot jsonb NOT NULL,
  UNIQUE(order_id, participant_index, kind)
);
CREATE TABLE IF NOT EXISTS outbox (
  id uuid PRIMARY KEY,
  position bigserial UNIQUE NOT NULL,
  order_id uuid NOT NULL REFERENCES orders(id),
  document_id uuid REFERENCES documents(id),
  recipient text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','sent','failed')),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  locked_at timestamptz,
  sent_at timestamptz
);
CREATE TABLE IF NOT EXISTS audit_log (
  id bigserial PRIMARY KEY,
  order_id uuid REFERENCES orders(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  action text NOT NULL,
  actor text NOT NULL
);
CREATE TABLE IF NOT EXISTS rate_limits (
  key text PRIMARY KEY,
  count integer NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS orders_created_idx ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS outbox_status_idx ON outbox(status);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_dates jsonb;
ALTER TABLE outbox ADD COLUMN IF NOT EXISTS position bigserial UNIQUE;
`;
