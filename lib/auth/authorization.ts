export type Role = "admin" | "editor";

export interface Actor {
  id: string;
  email: string;
  role: Role;
}

export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthorizationError";
  }
}

const DEFAULT_ROLES: Role[] = ["admin", "editor"];

/**
 * Single authorization choke point. Every privileged service call goes through
 * this so role checks cannot be forgotten in one code path only.
 */
export function requireActor(
  user: unknown,
  roles: Role[] = DEFAULT_ROLES,
): Actor {
  if (!user || typeof user !== "object") {
    throw new AuthorizationError("Authentication required");
  }
  const candidate = user as Partial<Actor>;
  if (typeof candidate.id !== "string" || candidate.id.length === 0) {
    throw new AuthorizationError("Authentication required");
  }
  if (candidate.role !== "admin" && candidate.role !== "editor") {
    throw new AuthorizationError("Invalid role");
  }
  if (!roles.includes(candidate.role)) {
    throw new AuthorizationError("Insufficient permissions");
  }
  return {
    id: candidate.id,
    email: typeof candidate.email === "string" ? candidate.email : "",
    role: candidate.role,
  };
}

export function isAdmin(actor: Actor): boolean {
  return actor.role === "admin";
}

/** Destructive / account-level actions are restricted to admins. */
export function requireAdmin(user: unknown): Actor {
  return requireActor(user, ["admin"]);
}
