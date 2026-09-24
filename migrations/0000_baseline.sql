-- Baseline extracted from the existing runtime initializer; additive for existing databases.

      CREATE TABLE IF NOT EXISTS organizations (
        id UUID PRIMARY KEY,
        name VARCHAR(120) NOT NULL,
        tax_id VARCHAR(32),
        email VARCHAR(320),
        timezone VARCHAR(80) NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
        currency CHAR(3) NOT NULL DEFAULT 'ARS',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY,
        email VARCHAR(320) UNIQUE NOT NULL,
        name VARCHAR(120) NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS organization_members (
        id UUID PRIMARY KEY,
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(32) NOT NULL DEFAULT 'OWNER',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (organization_id, user_id)
      );
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY,
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        action VARCHAR(100) NOT NULL,
        entity_type VARCHAR(100) NOT NULL,
        entity_id UUID,
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS sessions (
        id UUID PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        kind VARCHAR(16) NOT NULL,
        token_hash CHAR(64) UNIQUE NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS audit_logs_organization_created_idx ON audit_logs (organization_id, created_at);
      CREATE INDEX IF NOT EXISTS sessions_token_hash_idx ON sessions (token_hash);
      ALTER TABLE sessions ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
      CREATE TABLE IF NOT EXISTS customers (
        id UUID PRIMARY KEY, organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        name VARCHAR(120) NOT NULL, email VARCHAR(320), phone VARCHAR(40), notes TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(organization_id,id)
      );
      CREATE TABLE IF NOT EXISTS products (
        id UUID PRIMARY KEY, organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        name VARCHAR(120) NOT NULL, sku VARCHAR(80) NOT NULL, price_cents INTEGER NOT NULL CHECK(price_cents >= 0),
        stock INTEGER NOT NULL DEFAULT 0 CHECK(stock >= 0), minimum_stock INTEGER NOT NULL DEFAULT 0 CHECK(minimum_stock >= 0),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(organization_id,id), UNIQUE(organization_id,sku)
      );
      CREATE TABLE IF NOT EXISTS sales (
        id UUID PRIMARY KEY, organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        customer_id UUID, total_cents BIGINT NOT NULL CHECK(total_cents >= 0), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(organization_id,id), FOREIGN KEY(organization_id,customer_id) REFERENCES customers(organization_id,id)
      );
      CREATE TABLE IF NOT EXISTS sale_items (
        id UUID PRIMARY KEY, organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        sale_id UUID NOT NULL, product_id UUID NOT NULL, quantity INTEGER NOT NULL CHECK(quantity > 0), price_cents INTEGER NOT NULL,
        FOREIGN KEY(organization_id,sale_id) REFERENCES sales(organization_id,id),
        FOREIGN KEY(organization_id,product_id) REFERENCES products(organization_id,id)
      );
      CREATE TABLE IF NOT EXISTS inventory_movements (
        id UUID PRIMARY KEY, organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        product_id UUID NOT NULL, quantity INTEGER NOT NULL CHECK(quantity <> 0), reason VARCHAR(240) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), FOREIGN KEY(organization_id,product_id) REFERENCES products(organization_id,id)
      );
      CREATE INDEX IF NOT EXISTS sales_org_date_idx ON sales(organization_id,created_at);
      CREATE INDEX IF NOT EXISTS inventory_org_date_idx ON inventory_movements(organization_id,created_at);
      ALTER TABLE customers ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';
      ALTER TABLE customers ADD COLUMN IF NOT EXISTS next_contact DATE;
      CREATE TABLE IF NOT EXISTS customer_activities (
        id UUID PRIMARY KEY, organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        customer_id UUID NOT NULL, user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        kind VARCHAR(20) NOT NULL CHECK(kind IN ('NOTE','CALL','MEETING','EMAIL')),
        description TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        FOREIGN KEY(organization_id,customer_id) REFERENCES customers(organization_id,id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS customer_activities_org_customer_idx ON customer_activities(organization_id,customer_id,created_at);
      CREATE TABLE IF NOT EXISTS quotes (
        id UUID PRIMARY KEY, organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        customer_id UUID, total_cents BIGINT NOT NULL CHECK(total_cents >= 0),
        status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','SENT','ACCEPTED','REJECTED','CONVERTED')),
        valid_until DATE, notes TEXT NOT NULL DEFAULT '', sale_id UUID, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(organization_id,id), UNIQUE(organization_id,sale_id),
        FOREIGN KEY(organization_id,customer_id) REFERENCES customers(organization_id,id),
        FOREIGN KEY(organization_id,sale_id) REFERENCES sales(organization_id,id)
      );
      CREATE TABLE IF NOT EXISTS quote_items (
        id UUID PRIMARY KEY, organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        quote_id UUID NOT NULL, product_id UUID NOT NULL, product_name VARCHAR(120) NOT NULL,
        quantity INTEGER NOT NULL CHECK(quantity>0), price_cents INTEGER NOT NULL CHECK(price_cents>=0),
        FOREIGN KEY(organization_id,quote_id) REFERENCES quotes(organization_id,id) ON DELETE CASCADE,
        FOREIGN KEY(organization_id,product_id) REFERENCES products(organization_id,id)
      );
      CREATE INDEX IF NOT EXISTS quotes_org_date_idx ON quotes(organization_id,created_at);
    
