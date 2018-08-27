create schema if not exists jore;
GRANT ALL ON SCHEMA jore TO postgres;
GRANT ALL ON SCHEMA jore TO jore;

create type jore.mode as ENUM ('BUS', 'TRAM', 'RAIL', 'SUBWAY', 'FERRY');
