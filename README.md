# Jore History GraphQL importer

Data importer for [jore-history-graphql](https://github.com/HSLdevcom/jore-history-graphql). The importer downloads a database export from an FTP server and imports it into a PostgreSQL database.

### Prerequisites

You need a Postgres database to run the import against. The app will apply the DB schema when starting.

> Ensure you are using the dev database (`transitlog-dev-cluster-c.postgres.database.azure.com`) or a local database when running locally.

### Build Docker container

Build the container:

```
docker build -t hsldevcom/jore-history-graphql-import:production .
```

Use the tags :dev, :stage and :production to target each environment. This way you can prevent code from being deployed to unintended environments.

### Build with build scripts

Instead of using the above command, you can use the provided deploy scripts. Please ensure you are logged in to Docker Hub before using them, as they will push the built image.

Example:

```shell script
./deploy-env.sh
```

The `deploy-env` script will prompt you for the environment you want to build for. Make a selection, for example `2` for the "development" environment. It will then build the image, tag it appropriately and push it to Docker Hub.

You can also use the `deploy-all.sh` script to build for all environments.

### Deployment

Please use the `play-update-jore-updater.yml` playbook in Transitlog-IAC to update the JORE importer service. Do this after pushing new image versions.

### Run

Check the .env files for an idea of which env variables you need to run the app. All env vars in the public .env files (eg. `.env.production`) with the value of `secret` need to be set manually when running the app. It is recommended to copy the production env file to `.env`, which is gitignored, and entering all the required information that can't be in the public file.

Make sure to add the appropriate credentials for the FTP server (USERNAME, PASSWORD). Ask the project team members for these.

Start the importer with Docker:

```shell script
docker run -p 8000:8000 --name jore-history-graphql-import hsldevcom/jore-history-graphql-import:production
```

Alternatively, when developing, start the importer directly with Node on your computer:

```shell script
yarn run start
```

Upon starting, the app will check that the DB is migrated fully and run any schema changes if needed. You can also run the migrations with `yarn run knex migrate:latest`. Check Knex docs for more information about migrations.

The import runs on a timer and will activate each night at around 3:00 am. Access the admin interface to trigger the import immediately.

If you want to extract the export ZIP file from the importer, bind a volume to the `/tmp/build` directory. The export will then be available to you after the importer has downloaded it. To run the import with a local export file, without using the FTP server, bind a volume to the `/source` directory. Both volume binds look roughly like this:

```bash
docker run -v ./source:/source:ro -v ./downloads:/tmp/build ...etc
```

When running without Docker, any downloaded files will be in the `downloads` directory of this project.

### Admin view

The app exposes an admin interface at port 8000 (by default) which is used to start an import, start an import from an uploaded file, selectively set tables or dump the database.

To access the admin view of an instance running in the cloud (dev or production), use an SSH tunnel to the host that is running the app. Run, for example: `ssh -L 8000:localhost:80 10.223.14.12` and then you can access the admin view at http://localhost:8000. Substitute the port number after `localhost` with the port you published from Docker and the private IP address with the one that your instance of the app uses.

The admin interface will ask you for credentials. These are `admin` and whatever `ADMIN_PASSWORD` you set in the env config. For development, it is `admin` and `secret`.

### Admin view options

The admin view exposes a few options. Under normal circumstances you don't need to use it, but it can be useful for development. Remember that all options are only stored in memory, so they will be reset when restarting the app!

#### Run daily import now

You can run the daily import immediately by pressing the "Run import task" button. This will download the latest export from the FTP server. In development, when the `DEBUG` env var is `true`, it is possible to re-import an already imported file. During normal operation this is not possible, as all imported exports are kept track of in the `public.import_status` table of the connected database. If an export is imported successfully, importing it again will be blocked.

Clicking the button will do exactly the same thing as has been scheduled to happen every night.

#### Upload an export archive

If you have a compatible export archive you can upload it through the admin interface and import it into the DB. It follows the same rules as the daily import, eg. a successfully imported export cannot be imported again when `DEBUG != true`. However, all uploaded exports get "-downloaded" appended to the filename, so they can be imported one more time if already successfully imported through the daily scheduled run.

#### Select tables to import

With these options you can select which tables you want to import. This setting is applied to all future imports, scheduled or manual, until the app is restarted. The setting is kept in memory only, so remember to set it again after restarting the app during development. All tables with a checked box will be imported, those without will not. This is useful if you want to test your code and skip large tables like `departure`.

You can also disable or enable importing and removing rows. In addition to the data for each table, each export archive also contains a `[table]_removed.dat` file which lists rows which have been removed from JORE since the last export. The "remove" feature of the importer removes these rows from the connected database. Remove is performed before import.

#### Upload dump of DB

Under normal operation, the importer will take a snapshot of the database and upload it to Azure blob storage. This does not happen when the `ENVIRONMENT` env var is not `local`. You can use this button to perform this manually.

## Development

The task of this importer is to download export files from an FTP server, open them, read them, and insert each row into the connected database. The export archive is produced every day except weekends at the end of the day, separately from this project.

The export archive contains a number of `.dat` files, each corresponding to a table in the database. It also contains `[table]_removed.dat` files which lists all rows that have been removed since the previous export archive was generated.

Each .dat file in the archive contains rows which are to be inserted in the database. The fields are not separated, but the schema contains the length of each field so that they can be read into database columns.

> Note that you need quite a lot of memory on your machine to run the importer as it handles a lot of data. The import may crash when running locally. It is a good idea to exclude the `departures` table from any test imports that you do to both lower the memory requirements of the import and make it complete faster.

### Schema

The schema of the database and the dat files is described in the `schema.js` file. In most cases, the schema for a line in the .dat file matches the database schema, but for the geometry table they look different. To accommodate this, the schema for each table can have an additional `lineSchema` property to describe how the lines should be read.

The top-level properties in the schema are table names. Under those, there is an object that describes the schema for the table, and, as mentioned earlier, an optional lineSchema property to describe the lines in the dat.

The properties for each table schema is:

```
{
  filename: name of the .dat file containing the data,
  lineSchema (optional): fields in the .dat file if different than the database,
  fields: fields in the database and .dat file,
  primary (optional): fields that constitute the primary key of the table
}
```

Each field description in the `fields` (or `lineSchema`) array is an object with the following properties:

```
{
  length: number, how many characters the data is in the .dat file,
  name: the name of the database column,
  type: the type of the database column,
  notNullable (optional): boolean, whether or not the field is nullable,
  index (optional): boolean, true to create an index of this field,
  primary (optional): boolean, true to make this field the primary key.
}
```

During database initialization, the schema file is read and the tables are created in the database based on the information. Find the code for this in the `setup/createDb.js` file.

### Data files

The files containing the data to be imported are .dat files, with one row per item to insert. The fields are read based on the lengths defined in the schema.js file which have been written based on the documentation of the data files. For example, if field A is defined as being 4 characters long, and field B is defined as 2 characters long, this is the result:

```
// .dat row
aaaabb

// Schema entry
{
  name: 'a',
  type: 'string',
  length: 4
}, {
  name: 'b',
  type: 'string',
  length: 2
}

// Database row (as JS object)
{
  a: 'aaaa',
  b: 'bb'
}
```

### Primary key

A primary key has been added to most tables. The primary key is used during both import and removal to identify rows.

During the removal process, the primary key of each line in the remove-files is calculated. Any rows in the database matching the primary key is removed.

### Importing

This is the process that happens when an import is running:

1. The cron scheduler triggers the update process. Alternatively, the process is triggered manually. `schedule.js`
2. The import process is marked as started. `index.js`
3. The FTP server is queried and the latest export archive is downloaded. In cases where the file has previously been found to be corrupted, or if it is already downloaded, nothing is downloaded from the server. `sources/fetchExportFromFTP.js`
4. The archive is unpacked and each file is sent through the import pipeline. `import.js`
5. For each file/table, the encoding is fixed to be utf-8. `import.js`
6. The file stream is split into lines. `import.js`
7. Each line is sent through a preprocessor which fixes the linebreaks and geometries. `preprocess.js`
8. Then, the stream is piped to the database importer. `database.js`
9. Each line is parsed into objects that can be processed easier with Javascript. `util/parseLine.js`
10. Future rows are filtered out, since this is a history database and rows that take place in the future may yet change. `util/futureFilter.js`
11. The item stream is collected into batches of at most 2000 (defined in `constants.js`). `database.js`
12. The batch is sent to the actual import query. `database.js`
13. The batched import query performs an "upsert" for each row in the batch. An upsert updates the row if found by the primary key, or inserts it if not found. If no keys or constraints are defined for the table, it just inserts everything.
14. This process is done as much in parallel as possible for each table, using a queueing system to not overwhelm the database connection. When the queue is processed for all tables, the import is finished. `import.js`
15. If not running locally (eg. in development), some tables are vacuumed and analyzed after the import. `import.js`
16. Also if not running locally, the database is dumped and uploaded to Azure Blob Storage. `util/createDbDump.js` and `util/uploadDbDump.js`.
17. Then the import is marked as finished and successful.

The geometry table is handled slightly differently, in that lines are grouped and combined by the route.

Errors or other exceptions are logged to the HSLdevcom slack (channel #transitlog-monitoring). In case the import was left unfinished or failed (after a server crash for example), it is retried the next time the service restarts.

### Tips and tricks

#### Delete the row for the file in import_status

If you need to reimport a file, you can enter the database and find the `public.import_status` table. This is the table that records all imported archives and marks them as complete. To reimport a file on an instance of the importer that is running without `DEBUG=true`, delete the row where `filename` equals the name of the file you're trying to import or set `success=false`.

#### Explore the raw .dat files

To check the dat files for data, use the command line. Many of the files are huge and cannot be opened in normal code editors.

Get an export archive either from the `downloads` directory or from the FTP server directly. Extract the .dat file you want to explore from the archive. The `aikat.dat` file is used here as an example. This file contains all departures and is the largest one.

Check the schema definition for how long the fields are, then you can build grep queries and find what the .dat file contains.

Lis the first 10 lines:

```shell script
head -n 10 aikat.dat
```

Find all lines for route 1001/1 on wednesdays from stop `1050417`:

```shell script
less aikat.dat | grep "10504171001  1Ke"
```

### Access logs

Once connected to an instance, check logs:

```
$ docker exec -it 42f257a81b9c sh
$ yarn run forever logs 0 -f
```
