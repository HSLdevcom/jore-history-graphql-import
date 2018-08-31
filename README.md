# Jore History GraphQL importer

Data importer for [jore-history-graphql](https://github.com/HSLdevcom/jore-history-graphql)

### Prerequisites

Start a postgis docker container using:

```
docker run --name jore-history-postgis -e POSTGRES_PASSWORD=mysecretpassword -d mdillon/postgis
```

Add `-v ./postgres-data:/var/lib/postgresql/data` to the command above to make sure that the database is persisted.
It is not needed for production as docker-compose handles volumes there.

### Install

Build the container:

```
docker build -t hsldevcom/jore-history-graphql-import .
```

### Run

Start the importer:

```
docker run
-v ./tmp:/tmp/build
-v ./data:/opt/jore/data
--env PG_CONNECTION_STRING=postgres://postgres:mysecretpassword@jore-history-postgis:5432/postgres
--env USERNAME=******
--env PASSWORD=******
--name jore-history-graphql-import
--link jore-history-postgis
hsldevcom/jore-history-graphql-import
```

Make sure to handle the volumes with Docker-compose in production and add the appropriate credentials for the FTP server.
