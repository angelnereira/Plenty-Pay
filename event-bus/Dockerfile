# PlentyPay — event-bus (NATS JetStream) Dockerfile
# SPEC: event-bus/SPEC.md
FROM natsio/nats-box:latest@sha256:d2f04223f40e016f77922a8115d34b0cd5fad2ec10b19b39316ae92d07f3d295 AS natsbox

FROM nats:2.10-alpine@sha256:b83efabe3e7def1e0a4a31ec6e078999bb17c80363f881df35edc70fcb6bb927

RUN apk add --no-cache bash jq curl

# Copiar CLI oficial de NATS
COPY --from=natsbox /usr/local/bin/nats /usr/local/bin/nats

# Copiar configuración, streams y KV
COPY nats.conf /etc/nats/nats.conf
COPY streams/ /etc/nats/streams/
COPY kv/ /etc/nats/kv/
COPY scripts/ /usr/local/bin/scripts/
COPY entrypoint.sh /usr/local/bin/entrypoint.sh

RUN chmod +x /usr/local/bin/entrypoint.sh /usr/local/bin/scripts/*.sh

EXPOSE 4222 8222

VOLUME ["/data/jetstream"]

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
