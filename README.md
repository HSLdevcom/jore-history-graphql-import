# Jore History GraphQL importer

Data importer for [jore-history-graphql](https://github.com/HSLdevcom/jore-history-graphql). The importer downloads a database export from an FTP server and imports it into a PostgreSQL database

### Prerequisites

Start a postgis docker container using:

```
docker run --name jore-history-postgis -e POSTGRES_PASSWORD=mysecretpassword -d mdillon/postgis
```

Add `-v ./postgres-data:/var/lib/postgresql/data` to the command above to make sure that the database is persisted.
It is not needed for production as docker-compose handles volumes there.

When the database is up, run `npm run initdb` to apply the JORE schema. The command may not have the correct port that the database is running on, so modify the npm command if necessary. The default port for Postgres is 5432.

The database is now ready for use.

### Install

Build the container:

```
docker build -t hsldevcom/jore-history-graphql-import .
```

### Run

Start the importer:

```
docker run \
--env PG_CONNECTION_STRING=postgres://postgres:mysecretpassword@jore-history-postgis:5432/postgres \
--env USERNAME=****** \
--env PASSWORD=****** \
--name jore-history-graphql-import \
--link jore-history-postgis \
hsldevcom/jore-history-graphql-import
```

Make sure to add the appropriate credentials for the FTP server (USERNAME, PASSWORD). Ask the project team members for these.

First, the importer downloads the latest export from the FTP server, then it runs the DB migrations to ensure any schema changes are applied. Make sure that migrations run without errors even if the changes they want to make are already applied in the schema.

The importer will then import the data and exit when done. It will take around an hour.

If you want to extract the export ZIP file from the importer, bind a volume to the `/tmp/build` directory. The export will then be available to you after the importer has downloaded it. To run the import with a local export file, without using the FTP server, bind a volume to the `/source` directory. Both volume binds look roughly like this:

```bash
docker run -v ./source:/source:ro -v ./downloads:/tmp/build ...etc
```

By default the importer will run the "daily import" which involves downloading the export from the FTP server. To change this, append `bash` to the end of the run command at the start of this section and the importer will not do anything automatically. You can then choose which script you want to run from the command line.

### Scripts

There are two ways to import data with the importer. The "daily" method is the default, and it involves downloading the JORE export from an FTP server. If you have a database export file locally, and you mounted a volume at `/source`, you can import the database from that file without needing to use the FTP server.

To select which method to use, run the importer Docker container with the `bash` command:

```
docker run \
-v ./source:/source:ro \
--env PG_CONNECTION_STRING=postgres://postgres:mysecretpassword@jore-history-postgis:5432/postgres \
--env USERNAME=****** \
--env PASSWORD=****** \
--name jore-history-graphql-import \
--link jore-history-postgis \
hsldevcom/jore-history-graphql-import \
bash <-- add this
```

#### run_daily.sh

This is the default script that will run when running the Docker container without overriding the start command. It will download the export from the FTP server, so make sure that USERNAME and PASSWORD env variables are set. Ask the other members of the project team for these.

The script that downloads the file is called `fetch_faily.sh` and it can be run separately if needed.

#### run_local.sh

If you have a database export file locally, use run_local to import it. This is basically the same as run_daily, but it will use `fetch_local.sh` instead to expand the archive from the `/source` directory. Thus, mount a volume to `/source` and put your database export file there before running the container. Example:

```
host$ docker run \
-v ./source:/source:ro \
--env PG_CONNECTION_STRING=postgres://postgres:mysecretpassword@jore-history-postgis:5432/postgres \
--env USERNAME=****** \
--env PASSWORD=****** \
--name jore-history-graphql-import \
--link jore-history-postgis \
hsldevcom/jore-history-graphql-import \
bash

importer$ ./run_local.sh
```

### Other notes

- Some history exports may be too large for the FTP server, which is why the local import option exists. Ensure that the docker-compose configuration on the server mounts a volume to `/source` since you will probably need to import years worth of JORE data at some point.

### Database admin

You need to configure remote connectivity to the database separately. At this time conencting to it is only possible from other Docker containers on the same server.

To administrate the database directly, use `docker ps` to get the ID of the running jore-history-postgis container and access it like this:
```bash
docker exec -it [container ID or name] bash
```
Then, run `su postgres` to assume the identity of the postgres user. You can now run `psql` to get an SQL prompt.
