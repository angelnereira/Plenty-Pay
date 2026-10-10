import * as path from 'path';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';

/**
 * Servidor MCP de PlentyPay.
 *
 * NOTA DE DISEÑO: se usa la API de bajo nivel (`Server` + esquemas JSON planos)
 * en vez del helper `McpServer.registerTool` (más "bonito", basado en Zod).
 * Al verificar este servicio con `tsc`, `registerTool` con varias herramientas
 * en el mismo archivo agotó la memoria del compilador (los genéricos anidados
 * de esa API son pesados de inferir) y en un reintento con más memoria tardó
 * más de 5 minutos en un archivo con solo 4 tools. La API de bajo nivel no
 * tiene ese problema — a cambio, la validación de entrada aquí es manual
 * (`assertString`, etc.) en vez de inferida automáticamente de un esquema Zod.
 * Si el equipo crece y esto se vuelve una librería compartida, vale la pena
 * revisar si versiones futuras del SDK resuelven el problema de rendimiento.
 *
 * Este proceso NO tiene lógica de negocio propia — traduce llamadas MCP a
 * gRPC (payments-orchestrator, wallet-ledger) y a REST (catálogo, vía el
 * endpoint nuevo /api/public/v1/products/search). Ver documento 02 y el
 * README.md de este servicio.
 */

const PAYMENTS_ORCHESTRATOR_URL = process.env.PAYMENTS_ORCHESTRATOR_URL ?? 'localhost:50051';
const WALLET_LEDGER_URL = process.env.WALLET_LEDGER_URL ?? 'localhost:50052';
const PLENTYPAY_API_BASE_URL = process.env.PLENTYPAY_API_BASE_URL ?? 'http://localhost:3000';
const PLENTYPAY_API_KEY = process.env.PLENTYPAY_API_KEY ?? '';

function loadGrpcClient(protoFile: string, packagePath: string, serviceName: string, address: string) {
  const def = protoLoader.loadSync(path.join(__dirname, `../proto/${protoFile}`), {
    keepCase: false,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });
  const proto = grpc.loadPackageDefinition(def) as any;
  const ServiceCtor = packagePath.split('.').reduce((obj: any, key: string) => obj[key], proto)[serviceName];
  return new ServiceCtor(address, grpc.credentials.createInsecure());
}

const paymentsClient = loadGrpcClient('payments.proto', 'plentypay.payments.v1', 'PaymentOrchestrator', PAYMENTS_ORCHESTRATOR_URL);
const walletClient = loadGrpcClient('wallet.proto', 'plentypay.wallet.v1', 'WalletLedger', WALLET_LEDGER_URL);

function grpcCall(client: any, method: string, request: Record<string, unknown>): Promise<any> {
  return new Promise((resolve, reject) => {
    client[method](request, (err: grpc.ServiceError | null, response: any) => {
      if (err) reject(err);
      else resolve(response);
    });
  });
}

function textResult(obj: unknown) {
  return { content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] };
}

function errorResult(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true };
}

function requireString(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`El parámetro "${key}" es obligatorio y debe ser un string no vacío.`);
  }
  return value;
}

const TOOLS = [
  {
    name: 'plentypay_get_wallet_balance',
    description:
      'Devuelve el saldo disponible, retenido y pendiente de liquidación de la wallet interna de un cliente o comercio de PlentyPay.',
    inputSchema: {
      type: 'object',
      properties: {
        tenantId: { type: 'string', description: 'ID del tenant/organización en PlentyPay' },
        entityId: { type: 'string', description: 'ID de la MotorEntity (comprador o comercio)' },
      },
      required: ['tenantId', 'entityId'],
    },
  },
  {
    name: 'plentypay_create_payment_intent',
    description:
      'Crea una intención de cobro contra un riel externo (YAPPY, TELERED_CLAVE, CARD_VISA, CARD_MASTERCARD, APPLE_PAY, GOOGLE_PAY, QR_INTEROPERABLE). ' +
      'No usar para saldo de wallet interno. idempotencyKey es OBLIGATORIO y debe cambiar en cada operación real.',
    inputSchema: {
      type: 'object',
      properties: {
        tenantId: { type: 'string' },
        amountCents: { type: 'integer', minimum: 1, description: 'Monto en centavos, ej. 10000 = $100.00' },
        currency: { type: 'string', default: 'USD' },
        rail: {
          type: 'string',
          enum: ['YAPPY', 'TELERED_CLAVE', 'CARD_VISA', 'CARD_MASTERCARD', 'APPLE_PAY', 'GOOGLE_PAY', 'QR_INTEROPERABLE'],
        },
        idempotencyKey: { type: 'string' },
        reference: { type: 'string' },
      },
      required: ['tenantId', 'amountCents', 'rail', 'idempotencyKey'],
    },
  },
  {
    name: 'plentypay_get_payment_status',
    description: 'Consulta el estado actual de un pago por su transactionId (id del Payment).',
    inputSchema: {
      type: 'object',
      properties: { tenantId: { type: 'string' }, transactionId: { type: 'string' } },
      required: ['tenantId', 'transactionId'],
    },
  },
  {
    name: 'plentypay_search_products',
    description:
      'Busca productos en el catálogo de un comercio de PlentyPay por nombre, SKU o código de barras. ' +
      'Requiere PLENTYPAY_API_KEY configurada (ApiKey real con permiso "products:read").',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Texto de búsqueda; vacío devuelve los primeros resultados' },
        limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
      },
    },
  },
];

const server = new Server({ name: 'plentypay', version: '0.1.0' }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const args = (request.params.arguments ?? {}) as Record<string, unknown>;

  try {
    switch (request.params.name) {
      case 'plentypay_get_wallet_balance': {
        const tenantId = requireString(args, 'tenantId');
        const entityId = requireString(args, 'entityId');
        return textResult(await grpcCall(walletClient, 'getBalance', { tenantId, entityId }));
      }

      case 'plentypay_create_payment_intent': {
        const tenantId = requireString(args, 'tenantId');
        const rail = requireString(args, 'rail');
        const idempotencyKey = requireString(args, 'idempotencyKey');
        const amountCents = args.amountCents;
        if (typeof amountCents !== 'number' || amountCents <= 0) {
          throw new Error('"amountCents" debe ser un número entero positivo.');
        }
        return textResult(
          await grpcCall(paymentsClient, 'createChargeIntent', {
            tenantId,
            amountCents: String(amountCents),
            currency: typeof args.currency === 'string' ? args.currency : 'USD',
            rail,
            idempotencyKey,
            reference: typeof args.reference === 'string' ? args.reference : '',
          })
        );
      }

      case 'plentypay_get_payment_status': {
        const tenantId = requireString(args, 'tenantId');
        const transactionId = requireString(args, 'transactionId');
        return textResult(await grpcCall(paymentsClient, 'getChargeStatus', { tenantId, transactionId }));
      }

      case 'plentypay_search_products': {
        if (!PLENTYPAY_API_KEY) throw new Error('PLENTYPAY_API_KEY no está configurada — ver .env.example.');
        const url = new URL('/api/public/v1/products/search', PLENTYPAY_API_BASE_URL);
        if (typeof args.query === 'string' && args.query) url.searchParams.set('q', args.query);
        url.searchParams.set('limit', String(typeof args.limit === 'number' ? args.limit : 10));

        const response = await fetch(url, { headers: { Authorization: `Bearer ${PLENTYPAY_API_KEY}` } });
        if (!response.ok) throw new Error(`PlentyPay API respondió ${response.status}: ${await response.text()}`);
        return textResult(await response.json());
      }

      default:
        throw new Error(`Herramienta desconocida: ${request.params.name}`);
    }
  } catch (err) {
    return errorResult(err);
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('plentypay mcp-server conectado por stdio'); // stdout está reservado para el protocolo MCP
}

main().catch((err) => {
  console.error('mcp-server: fallo fatal', err);
  process.exit(1);
});

// TODO(producción): para clientes remotos (un bot de Jelou/WhatsApp, por
// ejemplo) en vez de un cliente de escritorio local, cambiar
// StdioServerTransport por el transporte Streamable HTTP del SDK, detrás de
// autenticación real — este servidor puede mover dinero real, nunca exponerlo
// sin autenticar en la red pública.
