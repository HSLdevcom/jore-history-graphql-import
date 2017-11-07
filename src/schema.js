module.exports = {
  stop: {
    filename: "pysakki.dat",
    fields: [
      {
        length: 7,
        name: "stop_id",
        type: "string",
        unique: true,
        primary: true,
        index: true,
        notNullable: true,
      },
      { length: 7 },
      { length: 7 },
      {
        length: 8,
        name: "lat",
        type: "decimal",
        notNullable: true,
      },
      {
        length: 8,
        name: "lon",
        type: "decimal",
        notNullable: true,
      },
      {
        length: 20,
        name: "name_fi",
        type: "string",
        notNullable: true,
      },
      {
        length: 20,
        name: "name_se",
        type: "string",
        // TODO: Add when data conforms notNullable: true,
      },
      {
        length: 20,
        name: "address_fi",
        type: "string",
        // TODO: Add when data conforms notNullable: true,
      },
      {
        length: 20,
        name: "address_se",
        type: "string",
        // TODO: Add when data conforms notNullable: true,
      },
      { length: 3, name: "platform", type: "string" },
      { length: 7 },
      { length: 7 },
      { length: 20 },
      { length: 20 },
      { length: 2 },
      {
        length: 6,
        name: "short_id",
        type: "string",
        notNullable: true,
      },
      { length: 8 },
      { length: 8 },
      { length: 1 },
      { length: 15, name: "heading", type: "string" },
      { length: 1 },
      { length: 3 },
      {
        length: 7,
        name: "terminal_id",
        type: "string",
        foreign: "terminal.terminal_id",
      },
      {
        length: 7,
        name: "stop_area_id",
        type: "string",
        foreign: "stop_area.stop_area_id",
      },
    ],
  },
  terminal: {
    filename: "terminaali.dat",
    fields: [
      {
        length: 7,
        name: "terminal_id",
        type: "string",
        unique: true,
        primary: true,
        index: true,
        notNullable: true,
      },
      {
        length: 40,
        name: "name_fi",
        type: "string",
        notNullable: true,
      },
      {
        length: 40,
        name: "name_se",
        type: "string",
        notNullable: true,
      },
      { length: 14 },
      { length: 8, name: "lat", type: "decimal" },
      { length: 8, name: "lon", type: "decimal" },
    ],
  },
  terminal_group: {
    filename: "terminaaliryhma.dat",
    fields: [
      {
        length: 7,
        name: "terminal_id_from",
        type: "string",
        index: true,
        foreign: "terminal.terminal_id",
        notNullable: true,
      },
      {
        length: 7,
        name: "terminal_id_to",
        type: "string",
        index: true,
        foreign: "terminal.terminal_id",
        notNullable: true,
      },
    ],
  },
  stop_area: {
    filename: "pysakkialue.dat",
    fields: [
      {
        length: 6,
        name: "stop_area_id",
        type: "string",
        unique: true,
        primary: true,
        index: true,
        notNullable: true,
      },
      {
        length: 40,
        name: "name_fi",
        type: "string",
        notNullable: true,
      },
      {
        length: 40,
        name: "name_se",
        type: "string",
        notNullable: true,
      },
      { length: 14 },
      { length: 8, name: "lat", type: "decimal" },
      { length: 8, name: "lon", type: "decimal" },
    ],
  },
  line: {
    filename: "linjannimet2.dat",
    fields: [
      {
        length: 6,
        name: "line_id",
        type: "string",
        index: true,
        notNullable: true,
      },
      {
        length: 60,
        name: "name_fi",
        type: "string",
        notNullable: true,
      },
      {
        length: 60,
        name: "name_se",
        type: "string",
        // TODO: Add when data conforms notNullable: true,
      },
      {
        length: 30,
        name: "origin_fi",
        type: "string",
        notNullable: true,
      },
      {
        length: 30,
        name: "origin_se",
        type: "string",
        // TODO: Add when data conforms notNullable: true,
      },
      {
        length: 30,
        name: "destination_fi",
        type: "string",
        // TODO: Add when data conforms notNullable: true,
      },
      {
        length: 30,
        name: "destination_se",
        type: "string",
        // TODO: Add when data conforms notNullable: true,
      },
      {
        length: 8,
        name: "date_begin",
        type: "date",
        notNullable: true,
      },
      {
        length: 8,
        name: "date_end",
        type: "date",
        notNullable: true,
      },
    ],
    primary: ["line_id", "date_begin", "date_end"],
  },
  route: {
    filename: "linja3.dat",
    fields: [
      {
        length: 6,
        name: "route_id",
        type: "string",
        index: true,
        notNullable: true,
      },
      {
        length: 8,
        name: "date_begin",
        type: "date",
        notNullable: true,
      },
      {
        length: 8,
        name: "date_end",
        type: "date",
        notNullable: true,
      },
      {
        length: 1,
        name: "direction",
        type: "enu",
        typeOptions: ["1", "2"],
        notNullable: true,
      },
      {
        length: 60,
        name: "name_fi",
        type: "string",
        notNullable: true,
      },
      {
        length: 60,
        name: "name_se",
        type: "string",
        notNullable: true,
      },
      {
        length: 2,
        name: "type",
        type: "string",
        notNullable: true,
      },
      {
        length: 20,
        name: "origin_fi",
        type: "string",
        notNullable: true,
      },
      {
        length: 20,
        name: "origin_se",
        type: "string",
        // TODO: Add when data conforms notNullable: true,
      },
      {
        length: 7,
        name: "originstop_id",
        type: "string",
        foreign: "stop.stop_id",
        notNullable: true,
      },
      {
        length: 5,
        name: "route_length",
        type: "integer",
        notNullable: true,
      },
      {
        length: 20,
        name: "destination_fi",
        type: "string",
        notNullable: true,
      },
      {
        length: 20,
        name: "destination_se",
        type: "string",
        notNullable: true,
      },
      {
        length: 7,
        name: "destinationstop_id",
        type: "string",
        foreign: "stop.stop_id",
        notNullable: true,
      },
    ],
    primary: ["route_id", "direction", "date_begin", "date_end"],
  },
  route_segment: {
    filename: "reitti.dat",
    fields: [
      {
        length: 7,
        name: "stop_id",
        type: "string",
        foreign: "stop.stop_id",
        index: true,
        notNullable: true,
      },
      { length: 7, name: "next_stop_id", type: "string" },
      {
        length: 6,
        name: "route_id",
        type: "string",
        index: true,
        notNullable: true,
      },
      {
        length: 1,
        name: "direction",
        type: "enu",
        typeOptions: ["1", "2"],
        notNullable: true,
      },
      {
        length: 8,
        name: "date_begin",
        type: "date",
        notNullable: true,
      },
      {
        length: 8,
        name: "date_end",
        type: "date",
        notNullable: true,
      },
      { length: 20 },
      {
        length: 3,
        name: "duration",
        type: "integer",
        notNullable: true,
      },
      {
        length: 3,
        name: "stop_index",
        type: "integer",
        notNullable: true,
      },
      {
        length: 6,
        name: "distance_from_previous",
        type: "integer",
        notNullable: true,
      },
      {
        length: 6,
        name: "distance_from_start",
        type: "integer",
        notNullable: true,
      },
      {
        length: 1,
        name: "pickup_dropoff_type",
        type: "integer",
        // TODO: Add when data conforms notNullable: true,
      },
      { length: 2 },
      { length: 20, name: "destination_fi", type: "string" },
      { length: 20, name: "destination_se", type: "string" },
      { length: 20, name: "via_fi", type: "string" },
      { length: 20, name: "via_se", type: "string" },
      {
        length: 1,
        name: "timing_stop_type",
        type: "integer",
        notNullable: true,
      },
    ],
    primary: ["route_id", "direction", "date_begin", "date_end", "stop_index"],
  },
  point_geometry: {
    filename: "reittimuoto.dat",
    fields: [
      {
        length: 6,
        name: "route_id",
        type: "string",
        index: true,
      },
      {
        length: 1,
        name: "direction",
        type: "enu",
        typeOptions: ["1", "2"],
        notNullable: true,
      },
      {
        length: 8,
        name: "date_begin",
        type: "date",
        notNullable: true,
      },
      {
        length: 8,
        name: "date_end",
        type: "date",
        notNullable: true,
      },
      {
        length: 7,
        name: "node_id",
        type: "string",
        index: true,
        notNullable: true,
      },
      {
        length: 1,
        name: "node_type",
        type: "string",
        notNullable: true,
      },
      {
        length: 4,
        name: "index",
        type: "integer",
        notNullable: true,
      },
      {
        length: 7,
        name: "y",
        type: "integer",
        notNullable: true,
      },
      {
        length: 7,
        name: "x",
        type: "integer",
        notNullable: true,
      },
    ],
    // primary: ["route_id", "direction", "date_begin", "date_end", "index"]
  },
  departure: {
    filename: "aikat.dat",
    fields: [
      {
        length: 7,
        name: "stop_id",
        type: "string",
        foreign: "stop.stop_id",
        index: true,
        notNullable: true,
      },
      {
        length: 6,
        name: "route_id",
        type: "string",
        index: true,
        notNullable: true,
      },
      {
        length: 1,
        name: "direction",
        type: "enu",
        typeOptions: ["1", "2"],
        notNullable: true,
      },
      {
        length: 2,
        name: "day_type",
        type: "string",
        notNullable: true,
      },
      {
        length: 4,
        name: "departure_id",
        type: "integer",
        notNullable: true,
      },
      {
        length: 1,
        name: "is_next_day",
        type: "boolean",
        notNullable: true,
      },
      {
        length: 2,
        name: "hours",
        type: "integer",
        notNullable: true,
      },
      {
        length: 2,
        name: "minutes",
        type: "integer",
        notNullable: true,
      },
      {
        length: 1,
        name: "is_accessible",
        type: "boolean",
        notNullable: true,
      },
      {
        length: 8,
        name: "date_begin",
        type: "date",
        notNullable: true,
      },
      {
        length: 8,
        name: "date_end",
        type: "date",
        notNullable: true,
      },
      {
        length: 1,
        name: "stop_role",
        type: "integer",
        notNullable: true,
      },
      { length: 4, name: "note", type: "string" },
      { length: 1, name: "vehicle", type: "string" },
      {
        length: 1,
        name: "arrival_is_next_day",
        type: "boolean",
        notNullable: true,
      },
      {
        length: 2,
        name: "arrival_hours",
        type: "integer",
        notNullable: true,
      },
      {
        length: 2,
        name: "arrival_minutes",
        type: "integer",
        notNullable: true,
      },
      {
        length: 1,
        name: "extra_departure",
        type: "enu",
        typeOptions: ["L", /* What are these? */ "V", "0"],
      },
    ],
  },
  note: {
    filename: "linteks.dat",
    fields: [
      {
        length: 6,
        name: "line_id",
        type: "string",
        notNullable: true,
      },
      { length: 8 },
      { length: 8 },
      {
        length: 4,
        name: "note_id",
        type: "integer",
        notNullable: true,
      },
      {
        length: 6,
        name: "note_type",
        type: "string",
        notNullable: true,
      },
      {
        length: 200,
        name: "note_text",
        type: "string",
        notNullable: true,
      },
      {
        length: 8,
        name: "date_begin",
        type: "date",
        // TODO: Add when data conforms notNullable: true,
      },
      {
        length: 8,
        name: "date_end",
        type: "date",
        // TODO: Add when data conforms notNullable: true,
      },
    ],
  },
  geometry: {
    fields: [
      {
        length: 6,
        name: "route_id",
        type: "string",
        index: true,
        notNullable: true,
      },
      {
        length: 1,
        name: "direction",
        type: "enu",
        typeOptions: ["1", "2"],
        notNullable: true,
      },
      {
        length: 8,
        name: "date_begin",
        type: "date",
        notNullable: true,
      },
      {
        length: 8,
        name: "date_end",
        type: "date",
        notNullable: true,
      },
      {
        name: "mode",
        type: "specificType",
        typeOptions: "jore.mode",
      },
      {
        name: "geom",
        type: "specificType",
        typeOptions: "geometry(LineString,4326)",
        notNullable: true,
      },
      { name: "outliers", type: "integer" },
      { name: "min_likelihood", type: "float" },
    ],
  },
};
