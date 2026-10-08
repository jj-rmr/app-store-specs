-- Per-account website palette for databases created before this column.
-- Fresh installs get it from schema.sql. Nullable: absent means the device
-- choice (backward compatible). Run in the Supabase SQL editor.

alter table profiles add column if not exists palette text;

alter table profiles drop constraint if exists profiles_palette_valid;
alter table profiles add constraint profiles_palette_valid
  check (palette is null or palette in ('candy', 'ocean', 'sunset', 'forest', 'mono', 'bubblegum', 'citrus', 'grape', 'midnight'));
