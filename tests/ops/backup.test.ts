import { describe, it, expect } from "vitest";
import {
  backupFileName,
  parseBackupTimestamp,
  selectExpiredBackups,
} from "@/lib/ops/backup";

describe("backup helpers", () => {
  it("builds a sortable, database-scoped file name", () => {
    const name = backupFileName(new Date("2026-09-17T10:20:30.000Z"), "aidiscovery_dev");
    expect(name).toBe("backup-20260917T102030Z-aidiscovery_dev.dump");
  });

  it("sanitizes database names in file names", () => {
    const name = backupFileName(new Date("2026-01-02T03:04:05.000Z"), "db/weird name");
    expect(name).toMatch(/^backup-20260102T030405Z-db_weird_name\.dump$/);
  });

  it("parses timestamps back and treats unknown names as unparsable", () => {
    expect(parseBackupTimestamp("backup-20260917T102030Z-aidiscovery_dev.dump")).toBe(
      Date.UTC(2026, 8, 17, 10, 20, 30),
    );
    expect(parseBackupTimestamp("manual-copy.dump")).toBe(0);
  });

  it("keeps the newest N dumps and prunes the rest", () => {
    const names = [
      "backup-20260915T000000Z-db.dump",
      "backup-20260917T000000Z-db.dump",
      "backup-20260916T000000Z-db.dump",
    ];
    expect(selectExpiredBackups(names, 2)).toEqual([
      "backup-20260915T000000Z-db.dump",
    ]);
  });

  it("never prunes unrelated files, unknown names or fewer than retention", () => {
    const names = [
      "backup-20260917T000000Z-db.dump",
      "notes.txt",
      "manual-copy.dump",
    ];
    expect(selectExpiredBackups(names, 1)).toEqual([]);
  });

  it("treats a non-positive retention as keep-one", () => {
    const names = [
      "backup-20260917T000000Z-db.dump",
      "backup-20260916T000000Z-db.dump",
    ];
    expect(selectExpiredBackups(names, 0)).toEqual([
      "backup-20260916T000000Z-db.dump",
    ]);
  });
});
