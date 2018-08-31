create schema if not exists jore;
GRANT ALL ON SCHEMA jore TO postgres;

create type jore.mode as ENUM ('BUS', 'TRAM', 'RAIL', 'SUBWAY', 'FERRY');
