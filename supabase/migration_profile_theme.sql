-- Per-profile page theme for databases created before this column.
-- Fresh installs get it from schema.sql. Nullable: absent means the default
-- look. Run in the Supabase SQL editor.

alter table profiles add column if not exists theme text;
