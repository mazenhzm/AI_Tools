-- Creates the separate test database on first container init.
-- Guarded so a re-run on an existing volume does not fail.
CREATE DATABASE aidiscovery_test OWNER aidiscovery;

\connect aidiscovery_dev
CREATE EXTENSION IF NOT EXISTS pg_trgm;

\connect aidiscovery_test
CREATE EXTENSION IF NOT EXISTS pg_trgm;