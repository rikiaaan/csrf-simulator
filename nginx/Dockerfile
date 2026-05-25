FROM nginx:1.31.1-alpine3.23-slim AS cert

RUN apk add openssl && \
    openssl req -x509 -nodes -days 365 -newkey rsa:4096 -subj "/C=JP/O=rikiaaan/CN=csrf simulator" -keyout /server.key -out /server.crt



FROM nginx:1.31.1-alpine3.23-slim

COPY --from=cert /server.* /data/