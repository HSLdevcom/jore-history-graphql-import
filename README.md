# Jore GraphQL importer

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
docker run --link jore-history-postgis -e USERNAME="ftpusername" -e PASSWORD="ftppassword" -v ./downloads:/tmp/build -e "PG_CONNECTION_STRING=postgres://postgres:mysecretpassword@jore-history-postgis:5432/postgres" hsldevcom/jore-history-graphql-import
```
/home/daniel/Work/hsl/jore-history-graphql-import
