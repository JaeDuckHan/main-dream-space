-- server/migrations/011_site_settings_patch.sql
INSERT INTO site_settings (key, value) VALUES
  ('company_sale_no', '')
ON CONFLICT (key) DO NOTHING;
