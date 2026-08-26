-- Make the Ticket Number trigram index reachable.
--
-- `20260822000000_lab2_data_model` created `ticket_number` as `CHAR(25)`, and
-- `gin_trgm_ops` refuses a `character` column, so the trigram index had to be
-- built on the expression `(ticket_number::text)`. Prisma emits
-- `ticket_number ILIKE $1` with no cast, and PostgreSQL matches an expression
-- index only against that same expression -- so the index existed, every
-- structural assertion about it passed, and the planner could never use it.
-- `EXPLAIN` over 30,000 rows returned `Seq Scan on ticket` even under
-- `enable_seqscan = off`, which distinguishes an index the planner declined
-- from one it could not use at all.
--
-- Ticket Numbers are exactly 25 characters by the `ticket_ticket_number_format_check`
-- regex, which is anchored at both ends, so no stored value carries the blank
-- padding `CHAR` would otherwise have to be reasoned about. `VARCHAR(25)` holds
-- precisely what `CHAR(25)` held and the cast cannot truncate or pad anything.
--
-- This is a forward migration rather than an edit to the migration that created
-- the column: `20260822000000_lab2_data_model` has been applied, and changing an
-- applied migration's SQL changes its checksum, which fails `prisma migrate deploy`
-- against any database that already ran it.

-- Dropped before the type change rather than after. `ALTER COLUMN ... TYPE`
-- rebuilds dependent indexes automatically, and it would rebuild this one at its
-- own expression -- reproducing the cast on the new column and leaving the index
-- exactly as unreachable as before.
DROP INDEX ticket_ticket_number_trgm_idx;

-- The unique constraint `ticket_ticket_number_key` and the format CHECK are
-- rebuilt and revalidated by PostgreSQL as part of this statement.
ALTER TABLE ticket
  ALTER COLUMN ticket_number TYPE VARCHAR(25);

-- On the bare column now, exactly as `summary` and `description` already are.
CREATE INDEX ticket_ticket_number_trgm_idx
  ON ticket USING GIN (ticket_number gin_trgm_ops);
