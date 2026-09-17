export interface BackupFile {
  name: string;
  /** Milliseconds since epoch, or 0 when the name has no timestamp. */
  timestamp: number;
}

const TIMESTAMP_PATTERN = /^backup-(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/;

export function backupFileName(date: Date, database: string): string {
  const stamp = date
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z")
    .replace(/[-:]/g, "");
  const safeDatabase = database.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `backup-${stamp}-${safeDatabase}.dump`;
}

export function parseBackupTimestamp(name: string): number {
  const match = name.match(TIMESTAMP_PATTERN);
  if (!match) return 0;
  const [, year, month, day, hour, minute, second] = match;
  const parsed = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Returns the backups that should be removed so that at most `retention`
 * newest dumps remain. Unknown/unparsable files are left untouched.
 */
export function selectExpiredBackups(
  names: string[],
  retention: number,
): string[] {
  const keepCount = Math.max(1, Math.floor(retention));
  const known: BackupFile[] = names
    .filter((name) => name.endsWith(".dump"))
    .map((name) => ({ name, timestamp: parseBackupTimestamp(name) }))
    .filter((file) => file.timestamp > 0);

  if (known.length <= keepCount) return [];

  return known
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(keepCount)
    .map((file) => file.name);
}
