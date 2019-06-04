CREATE SCHEMA IF NOT EXISTS jore;
GRANT ALL ON SCHEMA jore TO postgres;

DO $$
    BEGIN
        CREATE TYPE jore.MODE AS ENUM ('BUS', 'TRAM', 'RAIL', 'SUBWAY', 'FERRY');
    EXCEPTION
        WHEN duplicate_object THEN NULL;
    END $$;

CREATE TABLE IF NOT EXISTS jore.import_status
(
    filename     VARCHAR(255) PRIMARY KEY,
    import_start TIMESTAMP NOT NULL DEFAULT now(),
    import_end   TIMESTAMP,
    success      BOOLEAN            DEFAULT FALSE
);

CREATE SCHEMA IF NOT EXISTS transitlog;
GRANT ALL ON SCHEMA transitlog TO postgres;
