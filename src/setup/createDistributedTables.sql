-- Create distributed tables for Citus.
-- All tables do not need to be distributed.

SELECT create_distributed_table('departure', 'route_id');
SELECT create_distributed_table('equipment', 'operator_id');
SELECT create_distributed_table('geometry', 'route_id');
SELECT create_distributed_table('line', 'line_id');
SELECT create_distributed_table('route', 'route_id');
SELECT create_distributed_table('route_segment', 'route_id');
SELECT create_distributed_table('stop', 'stop_id');
SELECT create_distributed_table('stop_area', 'stop_area_id');
