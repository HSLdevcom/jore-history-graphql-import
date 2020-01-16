-- Create distributed tables for Citus.
-- All tables do not need to be distributed.

SELECT create_distributed_table('jore.departure', 'route_id');
SELECT create_distributed_table('jore.equipment', 'registry_nr');
SELECT create_distributed_table('jore.route_geometry', 'route_id');
SELECT create_distributed_table('jore.line', 'line_id');
SELECT create_distributed_table('jore.route', 'route_id');
SELECT create_distributed_table('jore.route_segment', 'route_id');
SELECT create_distributed_table('jore.stop', 'stop_id');
SELECT create_distributed_table('jore.stop_area', 'stop_area_id');
