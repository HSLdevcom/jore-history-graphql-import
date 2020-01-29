-- Create distributed tables for Citus.
-- All tables do not need to be distributed.

SELECT create_distributed_table('jore.departure', 'route_id');
SELECT create_distributed_table('jore.equipment', 'registry_nr');
SELECT create_distributed_table('jore.exception_days', 'exception_day_type');
SELECT create_distributed_table('jore.exception_days_calendar', 'date_in_effect');
SELECT create_distributed_table('jore.replacement_days_calendar', 'date_in_effect', colocate_with => 'exception_days_calendar');
SELECT create_distributed_table('jore.line', 'line_id');
SELECT create_distributed_table('jore.route', 'route_id');
SELECT create_distributed_table('jore.geometry', 'route_id', colocate_with => 'route');
SELECT create_distributed_table('jore.route_segment', 'stop_id', colocate_with => 'departure');
SELECT create_distributed_table('jore.stop', 'stop_id', colocate_with => 'departure');
SELECT create_distributed_table('jore.terminal', 'terminal_id', colocate_with => 'stop');
SELECT create_distributed_table('jore.stop_area', 'stop_area_id', colocate_with => 'stop');
