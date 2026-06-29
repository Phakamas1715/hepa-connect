-- Run on the HOSxP MySQL/MariaDB server as an admin user only if you want
-- HEPA-Connect on this local PC to connect directly to HOSxP.
--
-- The failed test came from client host 192.168.212.1.
-- Prefer SELECT-only access for HEPA-GLUE.

-- Option A: allow only this local PC.
CREATE USER IF NOT EXISTS 'hepaglue_ro'@'192.168.212.1' IDENTIFIED BY 'CHANGE_STRONG_PASSWORD';
GRANT SELECT ON `nphosxp`.* TO 'hepaglue_ro'@'192.168.212.1';

-- Option B: allow the local subnet, if the PC IP changes.
-- CREATE USER IF NOT EXISTS 'hepaglue_ro'@'192.168.212.%' IDENTIFIED BY 'CHANGE_STRONG_PASSWORD';
-- GRANT SELECT ON `nphosxp`.* TO 'hepaglue_ro'@'192.168.212.%';

FLUSH PRIVILEGES;

-- Test from HEPA local PC after grant:
-- HOSXP_DB_HOST=192.168.215.21
-- HOSXP_DB_PORT=3306
-- HOSXP_DB_NAME=nphosxp
-- HOSXP_DB_USER=hepaglue_ro
-- HOSXP_DB_PASSWORD=CHANGE_STRONG_PASSWORD
