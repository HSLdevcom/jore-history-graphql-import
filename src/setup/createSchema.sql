CREATE EXTENSION IF NOT EXISTS postgis;

CREATE SCHEMA IF NOT EXISTS jore;
GRANT ALL ON SCHEMA jore TO CURRENT_USER;

DO $$
    BEGIN
        CREATE TYPE jore.MODE AS ENUM ('BUS', 'TRAM', 'RAIL', 'SUBWAY', 'FERRY');
    EXCEPTION
        WHEN duplicate_object THEN NULL;
    END $$;

CREATE TABLE IF NOT EXISTS import_status
(
    filename     VARCHAR(255) PRIMARY KEY,
    import_start TIMESTAMP NOT NULL DEFAULT now(),
    import_end   TIMESTAMP,
    success      BOOLEAN            DEFAULT FALSE,
    duration     INTEGER DEFAULT 0,
    file_error   BOOLEAN DEFAULT FALSE
);

CREATE SCHEMA IF NOT EXISTS transitlog;
GRANT ALL ON SCHEMA transitlog TO CURRENT_USER;
