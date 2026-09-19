-- Checkout S&K consent: admin-editable terms body + version stamp.
-- The dialog sends termsAcceptedAt; the service requires it to be >=
-- terms_updated_at (fail-closed). ON CONFLICT DO NOTHING: never overwrites
-- admin-configured values.

INSERT INTO settings (key, value, updated_at) VALUES
  ('checkout.terms_body', 'SYARAT & KETENTUAN

1. Produk berupa akun/lisensi digital yang dikirim setelah pembayaran dikonfirmasi.
2. Pastikan akun tujuan dan nomor WhatsApp benar sebelum memesan. Kesalahan pengisian di luar tanggung jawab kami.
3. Pesanan manual diproses pada jam aktif admin (08.00-20.00 WIB).
4. Dana yang sudah dibayarkan tidak dapat dikembalikan kecuali produk tidak dapat dipenuhi.
5. Dilarang menyalahgunakan akun (chargeback, share kredensial di luar ketentuan produk). Pelanggaran berakibat garansi hangus.', now()),
  ('checkout.terms_updated_at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), now())
ON CONFLICT (key) DO NOTHING;
