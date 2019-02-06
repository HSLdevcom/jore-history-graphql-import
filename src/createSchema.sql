create schema if not exists jore;
GRANT ALL ON SCHEMA jore TO postgres;

DO $$
  BEGIN
    CREATE TYPE jore.mode as ENUM ('BUS', 'TRAM', 'RAIL', 'SUBWAY', 'FERRY');
  EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
