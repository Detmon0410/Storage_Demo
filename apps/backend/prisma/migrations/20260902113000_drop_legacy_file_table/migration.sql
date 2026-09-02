-- Resolves pre-existing schema drift: the `File` table created in the initial scaffold
-- migration (20260901040221_init) was never part of the app's Prisma schema and had
-- already been removed from the live database outside of migration tracking. This
-- migration formalizes that removal so migration history matches reality.
DROP TABLE IF EXISTS `File`;
