create index on jore.departure (route_id, direction) where stop_role = 1;
create index on jore.departure (route_id, direction, stop_id);

create function jore.departure_is_regular_day_departure(departure jore.departure) returns boolean as
$$
begin
  return departure.day_type in ('Ma', 'Ti', 'Ke', 'To', 'Pe', 'La', 'Su')
    and departure.extra_departure is distinct from 'L';
end
$$ language plpgsql
   immutable;

create function jore.departure_origin_departure(departure jore.departure) returns jore.departure as
$$
select *
from jore.departure inner_departure
where inner_departure.route_id = departure.route_id
  and inner_departure.direction = departure.direction
  and inner_departure.date_begin = departure.date_begin
  and inner_departure.date_end = departure.date_end
  and inner_departure.departure_id = departure.departure_id
  and inner_departure.day_type = departure.day_type
  and inner_departure.stop_id = (
    select originstop_id
    from jore.route route
    where route.route_id = departure.route_id
      and route.direction = departure.direction
      and route.date_begin <= departure.date_end
      and route.date_end >= departure.date_begin
    order by route.date_begin DESC
    limit 1
  )
order by inner_departure.hours ASC, inner_departure.minutes ASC
limit 1;
$$ language sql
   stable;

create function jore.stop_departures_for_date(stop jore.stop, date date) returns setof jore.departure as
$$
select *
from jore.departure departure
where departure.stop_id = stop.stop_id
  and case when date is null then true else date between date_begin and date_end end;
$$ language sql
   stable;

create function jore.stop_route_segments_for_date(stop jore.stop, date date) returns setof jore.route_segment as
$$
select *
from jore.route_segment route_segment
where route_segment.stop_id = stop.stop_id
  and case when date is null then true else date between route_segment.date_begin and route_segment.date_end end;
$$ language sql
   stable;

create function jore.route_has_regular_day_departures(route jore.route, date date) returns boolean as
$$
select exists(
           select true
           from jore.departure departure
           where route.route_id = departure.route_id
             and route.direction = departure.direction
             and route.date_begin <= departure.date_end
             and route.date_end >= departure.date_begin
             and departure.stop_role = 1
             and jore.departure_is_regular_day_departure(departure)
             and case when date is null then true else date between departure.date_begin and departure.date_end end
         );
$$ language sql
   stable;

create function jore.route_segment_has_regular_day_departures(route_segment jore.route_segment, date date) returns boolean as
$$
select exists(
           select true
           from jore.departure departure
           where route_segment.route_id = departure.route_id
             and route_segment.direction = departure.direction
             and route_segment.date_begin <= departure.date_end
             and route_segment.date_end >= departure.date_begin
             and route_segment.stop_id = departure.stop_id
             and jore.departure_is_regular_day_departure(departure)
             and case when date is null then true else date between departure.date_begin and departure.date_end end
         );
$$ language sql
   stable;

create function jore.route_line(route jore.route) returns setof jore.line as
$$
select *
from jore.line line
where route.route_id like (line.line_id || '%')
order by line.line_id desc
limit 1;
$$ language sql
   stable;
-- TODO: investigate why we have to return a setof here

create function jore.route_segment_line(route_segment jore.route_segment) returns setof jore.line as
$$
select *
from jore.line line
where route_segment.route_id like (line.line_id || '%')
order by line.line_id desc
limit 1;
$$ language sql
   stable;
-- TODO: investigate why we have to return a setof here

create function jore.route_segment_route(route_segment jore.route_segment, date date) returns setof jore.route as
$$
select *
from jore.route route
where route_segment.route_id = route.route_id
  and route_segment.direction = route.direction
  and route.date_begin <= route_segment.date_end
  and route.date_end >= route_segment.date_begin
  and case when date is null then true else date between route.date_begin and route.date_end end
limit 1;
$$ language sql
   stable;
-- TODO: investigate why we have to return a setof here

create function jore.route_departure_notes(route jore.route, date date) returns jore.note as
$$
select *
from jore.note note
where note.line_id in (select line_id from jore.route_line(route))
  and route.date_begin <= note.date_end
  and route.date_end >= note.date_begin
  and case when date is null then true else date between note.date_begin and note.date_end end;
$$ language sql
   stable;

create function jore.route_segment_departure_notes(route_segment jore.route_segment, date date) returns jore.note as
$$
select *
from jore.note note
where note.line_id in (select line_id from jore.route_segment_line(route_segment))
  and route_segment.date_begin <= note.date_end
  and route_segment.date_end >= note.date_begin
  and case when date is null then true else date between note.date_begin and note.date_end end;
$$ language sql
   stable;

create function jore.line_notes(line jore.line, date date) returns setof jore.note as
$$
select *
from jore.note note
where line.line_id = note.line_id
  and (
    (note.date_begin is null or note.date_begin <= line.date_end)
    and (note.date_end is null or note.date_end >= line.date_begin)
    and case
          when date is null then true
          else (
              (note.date_begin is null or note.date_begin <= date)
              and (note.date_end is null or note.date_end >= date)
            ) end
  )
$$ language sql
   stable;

create function jore.route_segment_next_stops(route_segment jore.route_segment) returns setof jore.route_segment as
$$
select *
from jore.route_segment inner_route_segment
where route_segment.route_id = inner_route_segment.route_id
  and route_segment.direction = inner_route_segment.direction
  and route_segment.date_begin = inner_route_segment.date_begin
  and route_segment.date_end = inner_route_segment.date_end
  and route_segment.stop_index < inner_route_segment.stop_index;
$$ language sql
   stable;

create function jore.route_route_segments(route jore.route) returns setof jore.route_segment as
$$
select *
from jore.route_segment route_segment
where route.route_id = route_segment.route_id
  and route.direction = route_segment.direction
  and route.date_begin <= route_segment.date_end
  and route.date_end >= route_segment.date_begin;
$$ language sql
   stable;

create function jore.route_departures(route jore.route) returns setof jore.departure as
$$
select *
from jore.departure departure
where route.route_id = departure.route_id
  and route.direction = departure.direction
  and route.date_begin <= departure.date_end
  and route.date_end >= departure.date_begin;
$$ language sql
   stable;

create function jore.route_mode(route jore.route) returns jore.mode as
$$
select case
         when route is null then null
         else
           case route.type
             when '02' then 'TRAM'::jore.mode
             when '06' then 'SUBWAY'::jore.mode
             when '07' then 'FERRY'::jore.mode
             when '12' then 'RAIL'::jore.mode
             when '13' then 'RAIL'::jore.mode
             else 'BUS'::jore.mode
             end
         end;
$$ language sql
   immutable;

create type jore.departure_group as (
  stop_id character varying(7),
  route_id character varying(6),
  direction character varying(1),
  day_type character varying(2)[],
  is_next_day boolean,
  hours integer,
  minutes integer,
  is_accessible boolean,
  date_begin date,
  date_end date,
  stop_role integer,
  note character varying(4),
  vehicle character varying(3)[]
  );

create function jore.route_departures_grouped(route jore.route, date date) returns setof jore.departure_group as
$$
select departure.stop_id,
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
from jore.departure departure
where route.route_id = departure.route_id
  and route.direction = departure.direction
  and route.date_begin <= departure.date_end
  and route.date_end >= departure.date_begin
  and case when date is null then true else date between departure.date_begin and departure.date_end end
group by (departure.stop_id, departure.route_id, departure.direction, departure.is_next_day, departure.hours,
          departure.minutes,
          departure.is_accessible, departure.date_begin, departure.date_end, departure.stop_role, departure.note);
$$ language sql
   stable;

create function jore.route_segment_departures_grouped(route_segment jore.route_segment, date date) returns setof jore.departure_group as
$$
select departure.stop_id,
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
from jore.departure departure
where route_segment.route_id = departure.route_id
  and route_segment.stop_id = departure.stop_id
  and route_segment.direction = departure.direction
  and route_segment.date_begin <= departure.date_end
  and route_segment.date_end >= departure.date_begin
  and case when date is null then true else date between departure.date_begin and departure.date_end end
group by (departure.stop_id, departure.route_id, departure.direction, departure.is_next_day, departure.hours,
          departure.minutes,
          departure.is_accessible, departure.date_begin, departure.date_end, departure.stop_role, departure.note);
$$ language sql
   stable;

create function jore.stop_departures_grouped(stop jore.stop, date date) returns setof jore.departure_group as
$$
select departure.stop_id,
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
from jore.departure departure
where stop.stop_id = departure.stop_id
  and case when date is null then true else date between departure.date_begin and departure.date_end end
group by (departure.stop_id, departure.route_id, departure.direction, departure.is_next_day, departure.hours,
          departure.minutes,
          departure.is_accessible, departure.date_begin, departure.date_end, departure.stop_role, departure.note);
$$ language sql
   stable;

create function jore.line_routes(line jore.line) returns setof jore.route as
$$
select *
from jore.route route
where route.route_id like (line.line_id || '%')
  and not exists(
    select true
    from jore.line inner_line
    where inner_line.line_id like (line.line_id || '_%')
      and route.route_id like (inner_line.line_id || '%')
    limit 1
  );
$$ language sql
   stable;

create function jore.route_segment_notes(route_segment jore.route_segment, date date) returns setof jore.note as
$$
select note
from jore.note note
where note.line_id = (select line_id from jore.route_segment_line(route_segment))
  and (note.date_begin is null or note.date_begin <= route_segment.date_end)
  and (note.date_end is null or note.date_end >= route_segment.date_begin)
  and case
        when date is null then true
        else (
            (note.date_begin is null or note.date_begin <= date)
            and (note.date_end is null or note.date_end >= date)
          ) end;
$$ language sql
   stable;

create type jore.geometry_with_date as (
  geometry jsonb,
  date_begin date,
  date_end date
  );

create function jore.route_geometries(route jore.route, date date) returns setof jore.geometry_with_date as
$$
select ST_AsGeoJSON(geometry.geom)::jsonb, date_begin, date_end
from jore.geometry geometry
where route.route_id = geometry.route_id
  and route.direction = geometry.direction
  and route.date_begin <= geometry.date_end
  and route.date_end >= geometry.date_begin
  and case when date is null then true else date between geometry.date_begin and geometry.date_end end;
$$ language sql
   stable;

create function jore.stops_by_bbox(min_lat double precision,
                                   min_lon double precision,
                                   max_lat double precision,
                                   max_lon double precision) returns setof jore.stop as
$$
select *
from jore.stop stop
where stop.point && ST_MakeEnvelope(min_lon, min_lat, max_lon, max_lat, 4326);
$$ language sql
   stable;

create type jore.stop_grouped as (
  short_id character varying(6),
  name_fi character varying(20),
  name_se character varying(20),
  lat numeric(9, 6),
  lon numeric(9, 6),
  stop_ids character varying(7)[]
  );

create function jore.stop_grouped_by_short_id_by_bbox(min_lat double precision,
                                                      min_lon double precision,
                                                      max_lat double precision,
                                                      max_lon double precision) returns setof jore.stop_grouped as
$$
select stop.short_id, stop.name_fi, stop.name_se, stop.lat, stop.lon, array_agg(stop.stop_id)
from jore.stop stop
where stop.point && ST_MakeEnvelope(min_lon, min_lat, max_lon, max_lat, 4326)
group by stop.short_id, stop.name_fi, stop.name_se, stop.lat, stop.lon;
$$ language sql
   stable;

create function jore.stop_grouped_stops(stop_grouped jore.stop_grouped) returns setof jore.stop as
$$
select stop
from jore.stop
where stop.stop_id = any (stop_grouped.stop_ids);
$$ language sql
   stable;

create function jore.stop_siblings(stop jore.stop) returns setof jore.stop as
$$
select *
from jore.stop original_stop
where original_stop.short_id = stop.short_id
  and original_stop.name_fi = stop.name_fi
  and original_stop.name_se is not distinct from stop.name_se
  and original_stop.lat = stop.lat
  and original_stop.lon = stop.lon;
$$ language sql
   stable;

create or replace function jore.stop_modes(stop jore.stop, date date) returns setof jore.mode as
$$
select distinct jore.route_mode(jore.route_segment_route(route_segment, date))
from jore.stop_route_segments_for_date(stop, date) route_segment;
$$ language sql
   stable;

create function jore.terminal_modes(terminal jore.terminal, date date) returns setof jore.mode as
$$
select distinct jore.stop_modes(stop, date)
from jore.stop stop
where stop.terminal_id = terminal.terminal_id;
$$ language sql
   stable;

create function jore.stop_areas_by_bbox(min_lat double precision,
                                        min_lon double precision,
                                        max_lat double precision,
                                        max_lon double precision) returns setof jore.stop_area as
$$
select *
from jore.stop_area stop_area
where stop_area.point && ST_MakeEnvelope(min_lon, min_lat, max_lon, max_lat, 4326);
$$ language sql
   stable;

create function jore.terminals_by_bbox(min_lat double precision,
                                       min_lon double precision,
                                       max_lat double precision,
                                       max_lon double precision) returns setof jore.terminal as
$$
select *
from jore.terminal terminal
where terminal.point && ST_MakeEnvelope(min_lon, min_lat, max_lon, max_lat, 4326);
$$ language sql
   stable;
