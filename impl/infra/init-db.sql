-- Bootstrap databases for the five PT Kharade microservices.
CREATE DATABASE identity_db;
CREATE DATABASE catalog_pricing_db;
CREATE DATABASE orders_db;
CREATE DATABASE payments_db;
CREATE DATABASE notifications_db;

\c identity_db
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

\c catalog_pricing_db
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

\c orders_db
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

\c payments_db
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

\c notifications_db
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
