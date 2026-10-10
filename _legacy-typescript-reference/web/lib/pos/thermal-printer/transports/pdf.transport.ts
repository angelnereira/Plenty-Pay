import type { ReceiptData } from '../escpos-encoder';

export class PdfTransport {
  static isSupported(): boolean {
    return typeof window !== 'undefined';
  }

  async print(data: ReceiptData): Promise<void> {
    const date = data.date ?? new Date();
    const dateStr = date.toLocaleString('es-PA');

    const itemsHtml = data.items
      .map(
        (item) =>
          `<tr>
            <td>${item.qty}x ${escHtml(item.name)}</td>
            <td style="text-align:right">$${(item.price * item.qty).toFixed(2)}</td>
          </tr>`
      )
      .join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Recibo</title>
  <style>
    @page { size: 58mm auto; margin: 2mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: monospace; font-size: 10px; width: 54mm; }
    h1 { font-size: 12px; text-align: center; margin-bottom: 4px; }
    .divider { border-top: 1px dashed #000; margin: 4px 0; }
    table { width: 100%; border-collapse: collapse; }
    td { vertical-align: top; padding: 1px 0; }
    .total-row td { font-weight: bold; font-size: 12px; border-top: 1px solid #000; padding-top: 4px; }
    .footer { text-align: center; margin-top: 6px; font-size: 9px; }
  </style>
</head>
<body>
  <h1>${escHtml(data.businessName)}</h1>
  <div class="divider"></div>
  <p>${dateStr}</p>
  <div class="divider"></div>
  <table>
    <tbody>${itemsHtml}</tbody>
    <tfoot>
      <tr class="total-row">
        <td>TOTAL</td>
        <td style="text-align:right">$${data.total.toFixed(2)}</td>
      </tr>
    </tfoot>
  </table>
  ${data.paymentMethod ? `<p class="footer">Pago: ${escHtml(data.paymentMethod)}</p>` : ''}
  <div class="footer">Gracias por su compra</div>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=400,height=600');
    if (!win) {
      throw new Error('El navegador bloqueó la ventana emergente. Permita pop-ups para imprimir.');
    }

    win.document.write(html);
    win.document.close();
    setTimeout(() => {
      win.print();
      win.close();
    }, 500);
  }
}

function escHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
