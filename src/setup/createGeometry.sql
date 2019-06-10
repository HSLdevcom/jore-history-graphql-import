INSERT INTO jore.geometry
SELECT
  route_id,
  direction,
  date_begin,
  date_end,
  ST_MakeLine(point order by index asc) as geom,
  0 as outliers,
  0 as min_likelihood
FROM jore.point_geometry geometry
GROUP BY route_id, direction, date_begin, date_end;

CREATE INDEX ON jore.geometry USING GIST (geom);
