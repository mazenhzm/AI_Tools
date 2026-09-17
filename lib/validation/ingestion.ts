import { z } from "zod";

export const normalizedItemSchema = z.object({
  sourceItemId: z.string().min(1),
  name: z.string().min(2).max(200),
  slug: z
    .string()
    .min(1)
    .max(150)
    .regex(/^[\p{L}\p{N}-]+$/u, "slug must contain only letters, numbers and dashes"),
  websiteUrl: z.string().url().nullable(),
  domain: z.string().min(1).nullable(),
  summary: z.string().max(2000).nullable(),
  contentText: z.string().max(20000),
  publishedAt: z.date().nullable(),
  normalizedName: z.string().min(1),
  contentHash: z.string().min(8),
  categorySlug: z.string().nullable(),
});

export type NormalizedItemInput = z.infer<typeof normalizedItemSchema>;

export const rawSourceItemSchema = z.object({
  sourceItemId: z.string().min(1),
  title: z.string().nullable(),
  link: z.string().nullable(),
  summary: z.string().nullable(),
  content: z.string().nullable(),
  publishedAt: z.date().nullable(),
  author: z.string().nullable(),
  raw: z.record(z.string(), z.unknown()),
});
