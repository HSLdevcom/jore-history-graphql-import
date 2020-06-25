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

### Run

Check the .env files for an idea of which env variables you need to run the app. All env vars in the public .env files with the value of `secret` need to be set using Docker secrets or Azure keyvault.

Start the importer:

```
docker run -p 8000:8000 --name jore-history-graphql-import hsldevcom/jore-history-graphql-import:production
```

Make sure to add the appropriate credentials for the FTP server (USERNAME, PASSWORD). Ask the project team members for these.

Upon starting, the app will check that the DB is migrated fully and run any schema changes if needed. You can also run the migrations with `yarn run knex migrate:latest`. Check Knex docs for more information about migrations.

The import runs on a timer and will activate each night at around 3:00 am. Access the admin interface to trigger the import immediately.

If you want to extract the export ZIP file from the importer, bind a volume to the `/tmp/build` directory. The export will then be available to you after the importer has downloaded it. To run the import with a local export file, without using the FTP server, bind a volume to the `/source` directory. Both volume binds look roughly like this:

```bash
docker run -v ./source:/source:ro -v ./downloads:/tmp/build ...etc
```

### Admin view

The app exposes an admin interface at port 8000 (by default) which is used to start an import, start an import from an uploaded file, selectively set tables or dump the database.

To access the admin interface you need to

1. add a public IP to the host which is running the app and use `p 80:8000` when running the container to bind the ports,
2. Map the container to a domain with an app gateway from an internal network,
3. Use an SSH tunnel to the host that is running the app. Run, for example: `ssh -L 8000:localhost:8000 10.223.14.12` and then you can access the admin view at http://localhost:8000. Substitute the port number after `localhost` with the port you published from Docker and the private IP address with the one that your instance of the app uses.

The admin interface will ask you for credentials. These are `admin` and whatever `ADMIN_PASSWORD` you set in the env config.
