declare module 'thermal-printer-encoder' {
  interface EncoderOptions {
    language?: 'esc-pos' | 'star-prnt';
    width?: number;
    embedded?: boolean;
  }

  type Align = 'left' | 'center' | 'right';

  class ThermalPrinterEncoder {
    constructor(options?: EncoderOptions);
    initialize(): this;
    codepage(codepage: string): this;
    align(align: Align): this;
    bold(enabled?: boolean): this;
    line(text: string): this;
    text(text: string): this;
    newline(): this;
    cut(): this;
    encode(): Uint8Array;
  }

  export default ThermalPrinterEncoder;
}
