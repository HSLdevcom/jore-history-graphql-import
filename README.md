# Jore History GraphQL importer

Data importer for [jore-history-graphql](https://github.com/HSLdevcom/jore-history-graphql). The importer downloads a database export from an FTP server and imports it into a PostgreSQL database.

### Prerequisites

You need a Postgres database to run the import against. The app will apply the DB schema when starting.

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

To access the admin view of an instance running in the cloud (dev or production), use an SSH tunnel to the host that is running the app. Run, for example: `ssh -L 8000:localhost:8000 10.223.14.12` and then you can access the admin view at http://localhost:8000. Substitute the port number after `localhost` with the port you published from Docker and the private IP address with the one that your instance of the app uses.

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

The export archive contains a number of `.dat` files, each corresponding to a table in the database. It also contains `[table]_removed.dat` files which lists all rows that have been removed since the previous export arhive.

### Schema

The schema of the database and the dat files is described in the `schema.js` file.
