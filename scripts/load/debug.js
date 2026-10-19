import grpc from 'k6/net/grpc';
const client = new grpc.Client();
client.load(['../../network-contracts/proto'], 'ledger.proto');

export default () => {
  client.connect('ledger-load:50061', { plaintext: true });
  const req = {
    idempotency_key: `dbg-${__VU}-${__ITER}`,
    transaction_type: 'PAYMENT',
    currency: 'USD',
    entries: [
      { account: { party_id: '11111111-1111-1111-1111-111111111111', type: 1, currency: 'USD', scope_id: '' }, side: 1, amount_minor: 10000 },
      { account: { party_id: '22222222-2222-2222-2222-222222222222', type: 2, currency: 'USD', scope_id: '' }, side: 2, amount_minor: 10000 },
    ],
  };
  const resp = client.invoke('plentypay.ledger.v1.Ledger/PostTransaction', req);
  console.log('STATUS:', resp.status, 'MSG:', resp.error ? resp.error.message : 'none');
  client.close();
};
