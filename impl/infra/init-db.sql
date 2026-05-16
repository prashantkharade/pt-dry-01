-- Bootstrap databases for the three services.
CREATE DATABASE identity_db;
CREATE DATABASE orders_db;
CREATE DATABASE notifications_db;

\c identity_db
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

\c orders_db
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

\c notifications_db
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
