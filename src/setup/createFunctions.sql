create index on jore.departure (route_id, direction) where stop_role = 1;
create index on jore.departure (route_id, direction, stop_id);

create or replace FUNCTION jore.departure_origin_departure(departure jore.DEPARTURE) RETURNS jore.DEPARTURE AS
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
    order by route.date_begin desc
    limit 1
)
order by inner_departure.hours asc, inner_departure.minutes asc
limit 1;
$$ LANGUAGE SQL
    STABLE;

create or replace FUNCTION jore.stop_route_segments_for_date(stop jore.STOP, date DATE) RETURNS SETOF jore.ROUTE_SEGMENT AS
$$
select *
from jore.route_segment route_segment
where route_segment.stop_id = stop.stop_id
  and case when date is null then true else date >= route_segment.date_begin end;
$$ LANGUAGE SQL
    STABLE;

create or replace FUNCTION jore.route_segment_route(route_segment jore.ROUTE_SEGMENT, date DATE) RETURNS SETOF jore.ROUTE AS
$$
select *
from jore.route route
where route_segment.route_id = route.route_id
  and route_segment.direction = route.direction
  and route.date_begin <= route_segment.date_end
  and route.date_end >= route_segment.date_begin
  and case when date is null then true else date >= route.date_begin end
limit 1;
$$ LANGUAGE SQL
    STABLE;
-- TODO: investigate why we have to return a setof here

create or replace FUNCTION jore.route_route_segments(route jore.ROUTE) RETURNS SETOF jore.ROUTE_SEGMENT AS
$$
select *
from jore.route_segment route_segment
where route.route_id = route_segment.route_id
  and route.direction = route_segment.direction
  and route.date_begin <= route_segment.date_end
  and route.date_end >= route_segment.date_begin;
$$ LANGUAGE SQL
    STABLE;

create or replace FUNCTION jore.route_mode(route jore.ROUTE) RETURNS jore.MODE AS
$$
select case
           when route is null then null
           else
               case route.type
                   when '02' then 'TRAM'::jore.MODE
                   when '06' then 'SUBWAY'::jore.MODE
                   when '07' then 'FERRY'::jore.MODE
                   when '12' then 'RAIL'::jore.MODE
                   when '13' then 'RAIL'::jore.MODE
                   else 'BUS'::jore.MODE
                   end
           end;
$$ LANGUAGE SQL
    IMMUTABLE;

create or replace FUNCTION jore.stop_modes(stop jore.STOP, date DATE) RETURNS SETOF jore.MODE AS
$$
select distinct jore.route_mode(jore.route_segment_route(route_segment, date))
from jore.stop_route_segments_for_date(stop, date) route_segment;
$$ LANGUAGE SQL
    STABLE;
