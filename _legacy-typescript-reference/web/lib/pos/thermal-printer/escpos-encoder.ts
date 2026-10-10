import type { PrinterProfile } from './printer-profiles';

export interface ReceiptData {
  businessName: string;
  items: Array<{
    name: string;
    qty: number;
    price: number;
  }>;
  total: number;
  paymentMethod?: string;
  date?: Date;
}

function padLine(left: string, right: string, width: number): string {
  const maxLeft = width - right.length - 1;
  const truncated = left.length > maxLeft ? left.slice(0, maxLeft) : left;
  return truncated + ' '.repeat(width - truncated.length - right.length) + right;
}

function centerText(text: string, width: number): string {
  const truncated = text.slice(0, width);
  const padding = Math.max(0, Math.floor((width - truncated.length) / 2));
  return ' '.repeat(padding) + truncated;
}

export async function buildReceiptBuffer(
  data: ReceiptData,
  profile: PrinterProfile
): Promise<Uint8Array> {
  // Dynamic import to avoid SSR issues
  const ThermalPrinterEncoder = (await import('thermal-printer-encoder')).default;

  const { width, cutCommand } = profile;
  const date = data.date ?? new Date();
  const dateStr = date.toLocaleString('es-PA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  let encoder = new ThermalPrinterEncoder({
    language: 'esc-pos',
    width,
  });

  encoder = encoder
    .initialize()
    .codepage('auto')
    .align('center')
    .bold(true)
    .line(data.businessName.slice(0, width))
    .bold(false)
    .align('left')
    .line('-'.repeat(width))
    .line(dateStr)
    .line('-'.repeat(width));

  for (const item of data.items) {
    const label = `${item.qty}x ${item.name}`;
    const priceStr = `$${(item.price * item.qty).toFixed(2)}`;
    encoder = encoder.line(padLine(label, priceStr, width));
  }

  encoder = encoder.line('-'.repeat(width));

  const totalStr = `$${data.total.toFixed(2)}`;
  const totalLine = padLine('TOTAL', totalStr, width);

  encoder = encoder
    .bold(true)
    .align('right')
    .line(totalLine)
    .bold(false)
    .align('center');

  if (data.paymentMethod) {
    encoder = encoder.line(`Pago: ${data.paymentMethod}`);
  }

  encoder = encoder.newline().newline();

  if (cutCommand) {
    encoder = encoder.cut();
  }

  return encoder.encode();
}
