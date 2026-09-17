import { describe, expect, it } from "vitest";
import {
  AuthorizationError,
  isAdmin,
  requireActor,
  requireAdmin,
} from "@/lib/auth/authorization";

const admin = { id: "u1", email: "admin@example.com", role: "admin" };
const editor = { id: "u2", email: "editor@example.com", role: "editor" };

describe("requireActor", () => {
  it("rejects missing or malformed users", () => {
    for (const value of [null, undefined, 42, "user", {}, { id: "" }]) {
      expect(() => requireActor(value)).toThrow(AuthorizationError);
    }
  });

  it("rejects unknown roles", () => {
    expect(() => requireActor({ id: "u3", role: "viewer" })).toThrow(
      AuthorizationError,
    );
  });

  it("accepts admins and editors by default", () => {
    expect(requireActor(admin)).toEqual(admin);
    expect(requireActor(editor)).toEqual(editor);
  });

  it("enforces the requested role list", () => {
    expect(() => requireActor(editor, ["admin"])).toThrow(
      AuthorizationError,
    );
    expect(requireActor(admin, ["admin"]).role).toBe("admin");
  });

  it("normalizes a missing email to an empty string", () => {
    expect(requireActor({ id: "u4", role: "admin" }).email).toBe("");
  });
});

describe("requireAdmin", () => {
  it("allows admins and blocks editors", () => {
    expect(requireAdmin(admin).role).toBe("admin");
    expect(() => requireAdmin(editor)).toThrow(AuthorizationError);
    expect(() => requireAdmin(null)).toThrow(AuthorizationError);
  });
});

describe("isAdmin", () => {
  it("reports the role", () => {
    expect(isAdmin({ id: "u1", email: "", role: "admin" })).toBe(true);
    expect(isAdmin({ id: "u2", email: "", role: "editor" })).toBe(false);
  });
});
