-- Keep the already-applied 0013 migration immutable. These models can be
-- installed on existing databases and are harmless if an admin added them first.
insert into public.catalog_product_models (category, brand, name, variant, aliases)
values
  ('gpu', 'AMD', 'Radeon RX 6800 XT', '16 GB', 'rx6800xt 6800xt'),
  ('gpu', 'AMD', 'Radeon RX 6900 XT', '16 GB', 'rx6900xt 6900xt')
on conflict do nothing;
