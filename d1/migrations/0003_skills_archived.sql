-- Skills are never deleted: a name, once used, stays resolvable forever so
-- that prompts referencing /name keep working. Retiring one archives it
-- instead — an archived skill still resolves everywhere it is already
-- referenced, it just stops being offered for new use and is flagged as
-- archived in the prompt editors. Replacing a skill means creating one
-- under a new name, not reusing an old one.
--
-- A separate migration rather than an edit to 0002: that one is already
-- merged and may already be applied.

ALTER TABLE skills ADD COLUMN archived INTEGER NOT NULL DEFAULT 0;
