export interface PrintRasterOptions {
  host: string;
  port?: number;
  rasterCopies: string[];
  feedLines?: number;
  cutMode?: 'full' | 'partial';
  cutAfterLast?: boolean;
  delayMs?: number;
}
export interface GS334PrinterPlugin {
  testConnection(options: { host: string; port?: number; timeoutMs?: number }): Promise<{ ok: boolean; message?: string }>;
  printRaster(options: PrintRasterOptions): Promise<{ ok: boolean; copies: number; message?: string }>;
}
export declare const GS334Printer: GS334PrinterPlugin;
