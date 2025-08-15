-- Create dedicated database user for Veeam Insight Dashboard
-- This script creates a specific user for managing the veeam_insight_db database
-- Run this as a superuser (like vaultuser) on the PostgreSQL server at 10.60.10.59

-- Connect to PostgreSQL as vaultuser:
-- psql -h 10.60.10.59 -p 5432 -U vaultuser -d postgres

-- 1. Create the dedicated veeam_insight user
CREATE USER veeam_insight WITH PASSWORD 'VeeamInsight2025!';

-- 2. Grant necessary privileges on the database
GRANT CONNECT ON DATABASE veeam_insight_db TO veeam_insight;
GRANT USAGE ON SCHEMA public TO veeam_insight;
GRANT CREATE ON SCHEMA public TO veeam_insight;

-- 3. Grant all privileges on existing tables
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO veeam_insight;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO veeam_insight;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO veeam_insight;

-- 4. Grant privileges on future tables (for schema migrations)
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO veeam_insight;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO veeam_insight;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO veeam_insight;

-- 5. Verify the user was created successfully
\du veeam_insight

-- 6. Test connection (optional - run separately)
-- \q
-- psql -h 10.60.10.59 -p 5432 -U veeam_insight -d veeam_insight_db

SELECT 'Veeam Insight user created successfully!' AS status;