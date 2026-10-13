# syntax=docker/dockerfile:1
FROM scylladb/scylla@sha256:a9d904089abe9a4f8b5b893ebb5b5bf8b5a1bd0dc6658921cf05f89d3712289c

COPY init/ /etc/scylla/init/
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
COPY scripts/ /usr/local/bin/scripts/

RUN chmod +x /usr/local/bin/entrypoint.sh /usr/local/bin/scripts/*.sh

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["--smp", "1", "--memory", "1G", "--developer-mode", "1", "--authenticator", "PasswordAuthenticator", "--authorizer", "CassandraAuthorizer", "--prometheus-port", "9180"]
