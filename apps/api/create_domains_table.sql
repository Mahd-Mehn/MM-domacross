-- Create domains table if it doesn't exist
CREATE TABLE IF NOT EXISTS domains (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    tld VARCHAR(10) NOT NULL DEFAULT 'eth',
    contract VARCHAR(255),
    token_id VARCHAR(255),
    owner VARCHAR(255),
    price VARCHAR(255),
    views INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name, tld)
);

-- Create domain_offers table if it doesn't exist  
CREATE TABLE IF NOT EXISTS domain_offers (
    id SERIAL PRIMARY KEY,
    domain_id INTEGER REFERENCES domains(id) ON DELETE CASCADE,
    offerer VARCHAR(255) NOT NULL,
    amount VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    message TEXT,
    tx_hash VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_domains_name ON domains(name);
CREATE INDEX IF NOT EXISTS idx_domains_price ON domains(price);
CREATE INDEX IF NOT EXISTS idx_domain_offers_domain_id ON domain_offers(domain_id);
CREATE INDEX IF NOT EXISTS idx_domain_offers_status ON domain_offers(status);
