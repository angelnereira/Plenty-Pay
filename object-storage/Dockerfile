# PlentyPay — object-storage (Garage S3-compatible) Dockerfile
# SPEC: object-storage/SPEC.md
#
# La imagen oficial de Garage es scratch (sin shell): se pasa el binario estático
# sobre busybox para poder ejecutar el entrypoint y los scripts de inicialización.
# Imágenes fijadas por digest (SPEC §2): una actualización es un cambio de commit.
FROM dxflrs/garage@sha256:9c96caa2612d3411acc5b0e6701fb238dbfba33e533a6d7d3d811a4b12d0d020 AS garage

FROM busybox@sha256:73aaf090f3d85aa34ee199857f03fa3a95c8ede2ffd4cc2cdb5b94e566b11662

LABEL org.opencontainers.image.title="plentypay-object-storage" \
      org.opencontainers.image.description="Garage S3-compatible object storage (F07.8)" \
      org.opencontainers.image.licenses="AGPL-3.0"

COPY --from=garage /garage /usr/local/bin/garage

# Configuración sin secretos: rpc_secret y admin_token llegan por entorno (compose).
COPY garage.toml /etc/garage.toml
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
COPY scripts/ /usr/local/bin/scripts/

RUN chmod +x /usr/local/bin/entrypoint.sh /usr/local/bin/scripts/*.sh

EXPOSE 3900 3901 3903

ENV GARAGE_CONFIG_FILE=/etc/garage.toml

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
