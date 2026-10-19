// k6 load test for ledger PostTransaction (F10.8).
// Uso: k6 run -e LEDGER_ADDR=localhost:50061 -e DATABASE_URL=... scripts/load/ledger-posttransaction.js
import grpc from 'k6/net/grpc';
import { check } from 'k6';

const client = new grpc.Client();
client.load(['../../network-contracts/proto'], 'ledger.proto');

export const options = {
  stages: [
    { duration: '30s', target: 50 },
    { duration: '60s', target: 500 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    'grpc_req_duration': ['p(99)<50'],
  },
};

export default () => {
  client.connect(__ENV.LEDGER_ADDR || 'localhost:50061', { plaintext: true });
  const req = {
    idempotency_key: `load-${__VU}-${__ITER}`,
    tenant_id: '',
    transaction_type: 'PAYMENT',
    currency: 'USD',
    entries: [
      { account: { party_id: '11111111-1111-1111-1111-111111111111', type: 1, currency: 'USD', scope_id: '' }, side: 1, amount_minor: 10000 },
      { account: { party_id: '22222222-2222-2222-2222-222222222222', type: 2, currency: 'USD', scope_id: '' }, side: 2, amount_minor: 10000 },
    ],
  };
  const resp = client.invoke('plentypay.ledger.v1.Ledger/PostTransaction', req);
  check(resp, { 'status OK': (r) => r && r.status === grpc.StatusOK });
  client.close();
};
