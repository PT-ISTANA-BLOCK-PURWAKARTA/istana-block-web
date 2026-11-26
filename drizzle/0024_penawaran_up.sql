-- Surat penawaran: penerima / PIC berbeda (U.p.); invoice: uang muka nominal (sama seperti app lama).
ALTER TABLE ops_quotations ADD COLUMN attn_name text;
ALTER TABLE ops_quotations ADD COLUMN attn_phone text;
ALTER TABLE ops_sales_invoices ADD COLUMN down_payment_amount real;
