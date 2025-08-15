-- Veeam Insight Dashboard Database Initialization
-- This script creates the veeam_insight_db database using existing vault credentials

-- Connect to PostgreSQL as vaultuser and run these commands:
-- psql -h 10.60.10.59 -p 5432 -U vaultuser -d vault

-- 1. Create the veeam_insight_db database
CREATE DATABASE veeam_insight_db;

-- 2. Grant privileges to vaultuser on the new database
GRANT ALL PRIVILEGES ON DATABASE veeam_insight_db TO vaultuser;

-- 3. Connect to the new database
\c veeam_insight_db;

-- 4. Grant schema privileges to vaultuser
GRANT ALL ON SCHEMA public TO vaultuser;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO vaultuser;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO vaultuser;

-- 5. Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO vaultuser;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO vaultuser;

-- Verification queries
-- Check if database exists
SELECT datname FROM pg_database WHERE datname = 'veeam_insight_db';

-- Check if user exists
SELECT rolname FROM pg_roles WHERE rolname = 'vaultuser';

-- Check user privileges
SELECT 
    grantee, 
    table_catalog, 
    privilege_type 
FROM information_schema.table_privileges 
WHERE grantee = 'vaultuser';