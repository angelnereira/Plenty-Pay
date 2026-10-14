#!/usr/bin/env node
// Cliente S3 mínimo para las pruebas de object-storage (herramienta de prueba,
// NO código desplegable — AGENTS.md §2.1, igual que scripts/ledger-tests).
// Firma SigV4 con la stdlib de Node (node:crypto) y habla con la API de Garage.
//
// Uso:
//   node s3cli.mjs <keyId> <secret> <GET|PUT|DELETE> <bucket> [key]
//   node s3cli.mjs <keyId> <secret> LIST <bucket>
// Salida: una línea con el código HTTP de la respuesta (p. ej. 200, 403).
import { createHmac, createHash } from "node:crypto";

const [keyId, secret, method, bucket, key] = process.argv.slice(2);
const endpoint = process.env.S3_ENDPOINT || "http://object-storage:3900";
const region = process.env.S3_REGION || "garage";

if (!keyId || !secret || !method || !bucket) {
  console.error("uso: s3cli.mjs <keyId> <secret> <GET|PUT|DELETE|LIST> <bucket> [key]");
  process.exit(2);
}

const hmac = (k, data) => createHmac("sha256", k).update(data).digest();
const sha256hex = (data) => createHash("sha256").update(data).digest("hex");

function sign(key, msg) {
  return createHmac("sha256", key).update(msg).digest();
}

// Construye la petición firmada SigV4 y devuelve el código HTTP.
async function s3Request(m, pathAndQuery, body) {
  const url = new URL(endpoint + pathAndQuery);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256hex(body ?? "");
  const host = url.host;

  const headers = {
    host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  if (body !== undefined) headers["content-type"] = "application/octet-stream";

  // Petición canónica (S3 exige headers ordenados y solo los firmados).
  const canonicalHeaders = Object.keys(headers)
    .sort()
    .map((h) => `${h}:${headers[h]}\n`)
    .join("");
  const signedHeaders = Object.keys(headers).sort().join(";");
  const canonicalRequest = [
    m,
    url.pathname,
    url.searchParams.toString(),
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const scope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    sha256hex(canonicalRequest),
  ].join("\n");

  const kDate = hmac("AWS4" + secret, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, "s3");
  const kSigning = hmac(kService, "aws4_request");
  const signature = createHmac("sha256", kSigning).update(stringToSign).digest("hex");

  headers.authorization =
    `AWS4-HMAC-SHA256 Credential=${keyId}/${scope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(url, { method: m, headers, body });
  if (process.env.S3_DEBUG) {
    console.error(`> ${m} ${url.pathname}${url.search} -> ${res.status}`);
    console.error(await res.clone().text());
  }
  await res.arrayBuffer().catch(() => {});
  return res.status;
}

const bucketPath = `/${bucket}`;
if (method.toUpperCase() === "LIST") {
  console.log(await s3Request("GET", `${bucketPath}/?list-type=2`));
  process.exit(0);
}

let pathAndQuery;
let body;
switch (method.toUpperCase()) {
  case "PUT":
    pathAndQuery = `${bucketPath}/${key ?? "test-probe"}`;
    body = process.env.S3_PUT_BODY ?? "probe";
    break;
  case "GET":
    pathAndQuery = `${bucketPath}/${key ?? "test-probe"}`;
    break;
  case "DELETE":
    pathAndQuery = `${bucketPath}/${key ?? "test-probe"}`;
    break;
  default:
    console.error("método no soportado");
    process.exit(2);
}

const status = await s3Request(method.toUpperCase(), pathAndQuery, body);
console.log(status);
void sign;
