CREATE INDEX ON jore.departure (route_id, direction) WHERE stop_role = 1;
CREATE INDEX ON jore.departure (route_id, direction, stop_id);

CREATE OR REPLACE FUNCTION jore.departure_is_regular_day_departure(departure jore.DEPARTURE) RETURNS BOOLEAN AS
$$
BEGIN
    RETURN departure.day_type IN ('Ma', 'Ti', 'Ke', 'To', 'Pe', 'La', 'Su')
        AND departure.extra_departure IS DISTINCT FROM 'L';
END
$$ LANGUAGE plpgsql
    IMMUTABLE;

CREATE OR REPLACE FUNCTION jore.departure_origin_departure(departure jore.DEPARTURE) RETURNS jore.DEPARTURE AS
$$
SELECT *
FROM jore.departure inner_departure
WHERE inner_departure.route_id = departure.route_id
  AND inner_departure.direction = departure.direction
  AND inner_departure.date_begin = departure.date_begin
  AND inner_departure.date_end = departure.date_end
  AND inner_departure.departure_id = departure.departure_id
  AND inner_departure.day_type = departure.day_type
  AND inner_departure.stop_id = (
                                    SELECT originstop_id
                                    FROM jore.route route
                                    WHERE route.route_id = departure.route_id
                                      AND route.direction = departure.direction
                                      AND route.date_begin <= departure.date_end
                                      AND route.date_end >= departure.date_begin
                                    ORDER BY route.date_begin DESC
                                    LIMIT 1
                                )
ORDER BY inner_departure.hours ASC, inner_departure.minutes ASC
LIMIT 1;
$$ LANGUAGE SQL
    STABLE;

CREATE OR REPLACE FUNCTION jore.stop_departures_for_date(stop jore.STOP, date DATE, route_id VARCHAR(6), direction TEXT) RETURNS SETOF jore.DEPARTURE AS
$$
SELECT *
FROM jore.departure departure
WHERE departure.stop_id = stop.stop_id
  AND CASE WHEN date IS NULL THEN TRUE ELSE date BETWEEN date_begin AND date_end END
  AND CASE WHEN route_id IS NULL THEN TRUE ELSE route_id = departure.route_id END
  AND CASE WHEN direction IS NULL THEN TRUE ELSE direction = departure.direction END;
$$ LANGUAGE SQL
    STABLE;

CREATE OR REPLACE FUNCTION jore.stop_route_segments_for_date(stop jore.STOP, date DATE) RETURNS SETOF jore.ROUTE_SEGMENT AS
$$
SELECT *
FROM jore.route_segment route_segment
WHERE route_segment.stop_id = stop.stop_id
  AND CASE WHEN date IS NULL THEN TRUE ELSE date BETWEEN route_segment.date_begin AND route_segment.date_end END;
$$ LANGUAGE SQL
    STABLE;

CREATE OR REPLACE FUNCTION jore.route_has_regular_day_departures(route jore.ROUTE, date DATE) RETURNS BOOLEAN AS
$$
SELECT exists(
       SELECT TRUE
       FROM jore.departure departure
       WHERE route.route_id = departure.route_id
         AND route.direction = departure.direction
         AND route.date_begin <= departure.date_end
         AND route.date_end >= departure.date_begin
         AND departure.stop_role = 1
         AND jore.departure_is_regular_day_departure(departure)
         AND CASE WHEN date IS NULL THEN TRUE ELSE date BETWEEN departure.date_begin AND departure.date_end END
           );
$$ LANGUAGE SQL
    STABLE;

CREATE OR REPLACE FUNCTION jore.route_segment_has_regular_day_departures(route_segment jore.ROUTE_SEGMENT, date DATE) RETURNS BOOLEAN AS
$$
SELECT exists(
       SELECT TRUE
       FROM jore.departure departure
       WHERE route_segment.route_id = departure.route_id
         AND route_segment.direction = departure.direction
         AND route_segment.date_begin <= departure.date_end
         AND route_segment.date_end >= departure.date_begin
         AND route_segment.stop_id = departure.stop_id
         AND jore.departure_is_regular_day_departure(departure)
         AND CASE WHEN date IS NULL THEN TRUE ELSE date BETWEEN departure.date_begin AND departure.date_end END
           );
$$ LANGUAGE SQL
    STABLE;

CREATE OR REPLACE FUNCTION jore.route_line(route jore.ROUTE) RETURNS SETOF jore.LINE AS
$$
SELECT *
FROM jore.line line
WHERE route.route_id LIKE (line.line_id || '%')
ORDER BY line.line_id DESC
LIMIT 1;
$$ LANGUAGE SQL
    STABLE;
-- TODO: investigate why we have to return a setof here

CREATE OR REPLACE FUNCTION jore.route_segment_line(route_segment jore.ROUTE_SEGMENT) RETURNS SETOF jore.LINE AS
$$
SELECT *
FROM jore.line line
WHERE route_segment.route_id LIKE (line.line_id || '%')
ORDER BY line.line_id DESC
LIMIT 1;
$$ LANGUAGE SQL
    STABLE;
-- TODO: investigate why we have to return a setof here

CREATE OR REPLACE FUNCTION jore.route_segment_route(route_segment jore.ROUTE_SEGMENT, date DATE) RETURNS SETOF jore.ROUTE AS
$$
SELECT *
FROM jore.route route
WHERE route_segment.route_id = route.route_id
  AND route_segment.direction = route.direction
  AND route.date_begin <= route_segment.date_end
  AND route.date_end >= route_segment.date_begin
  AND CASE WHEN date IS NULL THEN TRUE ELSE date BETWEEN route.date_begin AND route.date_end END
LIMIT 1;
$$ LANGUAGE SQL
    STABLE;
-- TODO: investigate why we have to return a setof here

CREATE OR REPLACE FUNCTION jore.route_departure_notes(route jore.ROUTE, date DATE) RETURNS jore.NOTE AS
$$
SELECT *
FROM jore.note note
WHERE note.line_id IN (
                          SELECT line_id
                          FROM jore.route_line(route)
                      )
  AND route.date_begin <= note.date_end
  AND route.date_end >= note.date_begin
  AND CASE WHEN date IS NULL THEN TRUE ELSE date BETWEEN note.date_begin AND note.date_end END;
$$ LANGUAGE SQL
    STABLE;

CREATE OR REPLACE FUNCTION jore.route_segment_departure_notes(route_segment jore.ROUTE_SEGMENT, date DATE) RETURNS jore.NOTE AS
$$
SELECT *
FROM jore.note note
WHERE note.line_id IN (
                          SELECT line_id
                          FROM jore.route_segment_line(route_segment)
                      )
  AND route_segment.date_begin <= note.date_end
  AND route_segment.date_end >= note.date_begin
  AND CASE WHEN date IS NULL THEN TRUE ELSE date BETWEEN note.date_begin AND note.date_end END;
$$ LANGUAGE SQL
    STABLE;

CREATE OR REPLACE FUNCTION jore.line_notes(line jore.LINE, date DATE) RETURNS SETOF jore.NOTE AS
$$
SELECT *
FROM jore.note note
WHERE line.line_id = note.line_id
  AND (
        (note.date_begin IS NULL OR note.date_begin <= line.date_end)
        AND (note.date_end IS NULL OR note.date_end >= line.date_begin)
        AND CASE
                WHEN date IS NULL THEN TRUE
                ELSE (
                        (note.date_begin IS NULL OR note.date_begin <= date)
                        AND (note.date_end IS NULL OR note.date_end >= date)
                    ) END
    )
$$ LANGUAGE SQL
    STABLE;

CREATE OR REPLACE FUNCTION jore.route_segment_next_stops(route_segment jore.ROUTE_SEGMENT) RETURNS SETOF jore.ROUTE_SEGMENT AS
$$
SELECT *
FROM jore.route_segment inner_route_segment
WHERE route_segment.route_id = inner_route_segment.route_id
  AND route_segment.direction = inner_route_segment.direction
  AND route_segment.date_begin = inner_route_segment.date_begin
  AND route_segment.date_end = inner_route_segment.date_end
  AND route_segment.stop_index < inner_route_segment.stop_index;
$$ LANGUAGE SQL
    STABLE;

CREATE OR REPLACE FUNCTION jore.route_route_segments(route jore.ROUTE) RETURNS SETOF jore.ROUTE_SEGMENT AS
$$
SELECT *
FROM jore.route_segment route_segment
WHERE route.route_id = route_segment.route_id
  AND route.direction = route_segment.direction
  AND route.date_begin <= route_segment.date_end
  AND route.date_end >= route_segment.date_begin;
$$ LANGUAGE SQL
    STABLE;

CREATE OR REPLACE FUNCTION jore.route_departures(route jore.ROUTE) RETURNS SETOF jore.DEPARTURE AS
$$
SELECT *
FROM jore.departure departure
WHERE route.route_id = departure.route_id
  AND route.direction = departure.direction
  AND route.date_begin <= departure.date_end
  AND route.date_end >= departure.date_begin;
$$ LANGUAGE SQL
    STABLE;

CREATE OR REPLACE FUNCTION jore.route_mode(route jore.ROUTE) RETURNS jore.MODE AS
$$
SELECT CASE
           WHEN route IS NULL THEN NULL
           ELSE
               CASE route.type
                   WHEN '02' THEN 'TRAM'::jore.MODE
                   WHEN '06' THEN 'SUBWAY'::jore.MODE
                   WHEN '07' THEN 'FERRY'::jore.MODE
                   WHEN '12' THEN 'RAIL'::jore.MODE
                   WHEN '13' THEN 'RAIL'::jore.MODE
                   ELSE 'BUS'::jore.MODE
                   END
           END;
$$ LANGUAGE SQL
    IMMUTABLE;

DO $$
    BEGIN
        CREATE TYPE jore.DEPARTURE_GROUP AS (
            stop_id CHARACTER VARYING(7),
            route_id CHARACTER VARYING(6),
            direction CHARACTER VARYING(1),
            day_type CHARACTER VARYING(2)[],
            is_next_day BOOLEAN,
            hours INTEGER,
            minutes INTEGER,
            is_accessible BOOLEAN,
            date_begin DATE,
            date_end DATE,
            stop_role INTEGER,
            note CHARACTER VARYING(4),
            vehicle CHARACTER VARYING(3)[]
            );

    EXCEPTION
        WHEN DUPLICATE_OBJECT THEN NULL;
    END $$;

CREATE OR REPLACE FUNCTION jore.route_departures_grouped(route jore.ROUTE, date DATE) RETURNS SETOF jore.DEPARTURE_GROUP AS
$$
SELECT departure.stop_id,
       departure.route_id,
       departure.direction,
       array_agg(departure.day_type),
       is_next_day,
       departure.hours,
       departure.minutes,
       departure.is_accessible,
       departure.date_begin,
       departure.date_end,
       departure.stop_role,
       departure.note,
       array_agg(departure.vehicle)
FROM jore.departure departure
WHERE route.route_id = departure.route_id
  AND route.direction = departure.direction
  AND route.date_begin <= departure.date_end
  AND route.date_end >= departure.date_begin
  AND CASE WHEN date IS NULL THEN TRUE ELSE date BETWEEN departure.date_begin AND departure.date_end END
GROUP BY (departure.stop_id, departure.route_id, departure.direction, departure.is_next_day, departure.hours,
          departure.minutes,
          departure.is_accessible, departure.date_begin, departure.date_end, departure.stop_role, departure.note);
$$ LANGUAGE SQL
    STABLE;

CREATE OR REPLACE FUNCTION jore.route_segment_departures_grouped(route_segment jore.ROUTE_SEGMENT, date DATE) RETURNS SETOF jore.DEPARTURE_GROUP AS
$$
SELECT departure.stop_id,
       departure.route_id,
       departure.direction,
       array_agg(departure.day_type),
       is_next_day,
       departure.hours,
       departure.minutes,
       departure.is_accessible,
       departure.date_begin,
       departure.date_end,
       departure.stop_role,
       departure.note,
       array_agg(departure.vehicle)
FROM jore.departure departure
WHERE route_segment.route_id = departure.route_id
  AND route_segment.stop_id = departure.stop_id
  AND route_segment.direction = departure.direction
  AND route_segment.date_begin <= departure.date_end
  AND route_segment.date_end >= departure.date_begin
  AND CASE WHEN date IS NULL THEN TRUE ELSE date BETWEEN departure.date_begin AND departure.date_end END
GROUP BY (departure.stop_id, departure.route_id, departure.direction, departure.is_next_day, departure.hours,
          departure.minutes,
          departure.is_accessible, departure.date_begin, departure.date_end, departure.stop_role, departure.note);
$$ LANGUAGE SQL
    STABLE;

CREATE OR REPLACE FUNCTION jore.stop_departures_grouped(stop jore.STOP, date DATE) RETURNS SETOF jore.DEPARTURE_GROUP AS
$$
SELECT departure.stop_id,
       departure.route_id,
       departure.direction,
       array_agg(departure.day_type),
       is_next_day,
       departure.hours,
       departure.minutes,
       departure.is_accessible,
       departure.date_begin,
       departure.date_end,
       departure.stop_role,
       departure.note,
       array_agg(departure.vehicle)
FROM jore.departure departure
WHERE stop.stop_id = departure.stop_id
  AND CASE WHEN date IS NULL THEN TRUE ELSE date BETWEEN departure.date_begin AND departure.date_end END
GROUP BY (departure.stop_id, departure.route_id, departure.direction, departure.is_next_day, departure.hours,
          departure.minutes,
          departure.is_accessible, departure.date_begin, departure.date_end, departure.stop_role, departure.note);
$$ LANGUAGE SQL
    STABLE;

CREATE OR REPLACE FUNCTION jore.line_routes(line jore.LINE) RETURNS SETOF jore.ROUTE AS
$$
SELECT *
FROM jore.route route
WHERE route.route_id LIKE (line.line_id || '%')
  AND NOT exists(
SELECT TRUE
FROM jore.line inner_line
WHERE inner_line.line_id LIKE (line.line_id || '_%')
  AND route.route_id LIKE (inner_line.line_id || '%')
LIMIT 1
    );
$$ LANGUAGE SQL
    STABLE;

CREATE OR REPLACE FUNCTION jore.route_segment_notes(route_segment jore.ROUTE_SEGMENT, date DATE) RETURNS SETOF jore.NOTE AS
$$
SELECT note
FROM jore.note note
WHERE note.line_id = (
                         SELECT line_id
                         FROM jore.route_segment_line(route_segment)
                     )
  AND (note.date_begin IS NULL OR note.date_begin <= route_segment.date_end)
  AND (note.date_end IS NULL OR note.date_end >= route_segment.date_begin)
  AND CASE
          WHEN date IS NULL THEN TRUE
          ELSE (
                  (note.date_begin IS NULL OR note.date_begin <= date)
                  AND (note.date_end IS NULL OR note.date_end >= date)
              ) END;
$$ LANGUAGE SQL
    STABLE;

DO $$
    BEGIN
        CREATE TYPE jore.GEOMETRY_WITH_DATE AS (
            geometry JSONB,
            date_begin DATE,
            date_end DATE
            );
    EXCEPTION
        WHEN duplicate_object THEN NULL;
    END $$;

CREATE OR REPLACE FUNCTION jore.route_geometries(route jore.ROUTE, date DATE) RETURNS SETOF jore.GEOMETRY_WITH_DATE AS
$$
SELECT ST_AsGeoJSON(geometry.geom)::JSONB, date_begin, date_end
FROM jore.geometry geometry
WHERE route.route_id = geometry.route_id
  AND route.direction = geometry.direction
  AND route.date_begin <= geometry.date_end
  AND route.date_end >= geometry.date_begin
  AND CASE WHEN date IS NULL THEN TRUE ELSE date BETWEEN geometry.date_begin AND geometry.date_end END;
$$ LANGUAGE SQL
    STABLE;

CREATE OR REPLACE FUNCTION jore.stops_by_bbox(min_lat DOUBLE PRECISION,
                                              min_lon DOUBLE PRECISION,
                                              max_lat DOUBLE PRECISION,
                                              max_lon DOUBLE PRECISION) RETURNS SETOF jore.STOP AS
$$
SELECT *
FROM jore.stop stop
WHERE stop.point && ST_MakeEnvelope(min_lon, min_lat, max_lon, max_lat, 4326);
$$ LANGUAGE SQL
    STABLE;

DO $$
    BEGIN
        CREATE TYPE jore.STOP_GROUPED AS (
            short_id CHARACTER VARYING(6),
            name_fi CHARACTER VARYING(20),
            name_se CHARACTER VARYING(20),
            lat NUMERIC(9, 6),
            lon NUMERIC(9, 6),
            stop_ids CHARACTER VARYING(7)[]
            );
    EXCEPTION
        WHEN duplicate_object THEN NULL;
    END $$;

CREATE OR REPLACE FUNCTION jore.stop_grouped_by_short_id_by_bbox(min_lat DOUBLE PRECISION,
                                                                 min_lon DOUBLE PRECISION,
                                                                 max_lat DOUBLE PRECISION,
                                                                 max_lon DOUBLE PRECISION) RETURNS SETOF jore.STOP_GROUPED AS
$$
SELECT stop.short_id, stop.name_fi, stop.name_se, stop.lat, stop.lon, array_agg(stop.stop_id)
FROM jore.stop stop
WHERE stop.point && ST_MakeEnvelope(min_lon, min_lat, max_lon, max_lat, 4326)
GROUP BY stop.short_id, stop.name_fi, stop.name_se, stop.lat, stop.lon;
$$ LANGUAGE SQL
    STABLE;

CREATE OR REPLACE FUNCTION jore.stop_grouped_stops(stop_grouped jore.STOP_GROUPED) RETURNS SETOF jore.STOP AS
$$
SELECT stop
FROM jore.stop
WHERE stop.stop_id = ANY (stop_grouped.stop_ids);
$$ LANGUAGE SQL
    STABLE;

CREATE OR REPLACE FUNCTION jore.stop_siblings(stop jore.STOP) RETURNS SETOF jore.STOP AS
$$
SELECT *
FROM jore.stop original_stop
WHERE original_stop.short_id = stop.short_id
  AND original_stop.name_fi = stop.name_fi
  AND original_stop.name_se IS NOT DISTINCT FROM stop.name_se
  AND original_stop.lat = stop.lat
  AND original_stop.lon = stop.lon;
$$ LANGUAGE SQL
    STABLE;

CREATE OR REPLACE FUNCTION jore.stop_modes(stop jore.STOP, date DATE) RETURNS SETOF jore.MODE AS
$$
SELECT DISTINCT jore.route_mode(jore.route_segment_route(route_segment, date))
FROM jore.stop_route_segments_for_date(stop, date) route_segment;
$$ LANGUAGE SQL
    STABLE;

CREATE OR REPLACE FUNCTION jore.terminal_modes(terminal jore.TERMINAL, date DATE) RETURNS SETOF jore.MODE AS
$$
SELECT DISTINCT jore.stop_modes(stop, date)
FROM jore.stop stop
WHERE stop.terminal_id = terminal.terminal_id;
$$ LANGUAGE SQL
    STABLE;

CREATE OR REPLACE FUNCTION jore.stop_areas_by_bbox(min_lat DOUBLE PRECISION,
                                                   min_lon DOUBLE PRECISION,
                                                   max_lat DOUBLE PRECISION,
                                                   max_lon DOUBLE PRECISION) RETURNS SETOF jore.STOP_AREA AS
$$
SELECT *
FROM jore.stop_area stop_area
WHERE stop_area.point && ST_MakeEnvelope(min_lon, min_lat, max_lon, max_lat, 4326);
$$ LANGUAGE SQL
    STABLE;

CREATE OR REPLACE FUNCTION jore.terminals_by_bbox(min_lat DOUBLE PRECISION,
                                                  min_lon DOUBLE PRECISION,
                                                  max_lat DOUBLE PRECISION,
                                                  max_lon DOUBLE PRECISION) RETURNS SETOF jore.TERMINAL AS
$$
SELECT *
FROM jore.terminal terminal
WHERE terminal.point && ST_MakeEnvelope(min_lon, min_lat, max_lon, max_lat, 4326);
$$ LANGUAGE SQL
    STABLE;
