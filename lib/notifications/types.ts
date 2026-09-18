import type { models, modelProviders, modelUpdates } from "@/lib/db/schema";

export type Channel = "email" | "telegram";
export type TargetType = "model" | "provider";

export type ModelRow = typeof models.$inferSelect;
export type ProviderRow = typeof modelProviders.$inferSelect;
export type ModelUpdateRow = typeof modelUpdates.$inferSelect;

export interface DeliverResult {
  ok: boolean;
  /** True when the message actually reached an external provider. */
  real: boolean;
  error?: string;
}

export interface EmailProvider {
  key: string;
  send(input: { to: string; subject: string; text: string }): Promise<DeliverResult>;
}

export interface TelegramProvider {
  key: string;
  send(input: { chatId: string; text: string }): Promise<DeliverResult>;
}

export interface NotificationProviderSet {
  email: EmailProvider | null;
  telegram: TelegramProvider | null;
}

export interface NotificationMessage {
  subject: string;
  text: string;
}