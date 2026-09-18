import { connect } from "node:net";
import { connect as tlsConnect } from "node:tls";
import { env } from "@/lib/env";
import type { DeliverResult, EmailProvider, TelegramProvider } from "./types";

// ---------------------------------------------------------------------------
// Email
// ---------------------------------------------------------------------------

/**
 * Deterministic stub used when no SMTP credentials are configured. It returns
 * `real: false` so the notification log records the delivery as skipped rather
 * than claiming an email was actually sent.
 */
export const logEmailProvider: EmailProvider = {
  key: "log",
  send(input): Promise<DeliverResult> {
    console.log(
      `[email:log] to=${input.to} subject=${input.subject} (SMTP not configured; not really sent)`,
    );
    return Promise.resolve({
      ok: true,
      real: false,
      error: "email delivery not configured (SMTP); notification logged only",
    });
  },
};

interface SmtpReply {
  code: number;
  lines: string[];
}

class SmtpError extends Error {
  readonly code: number;
  constructor(code: number, lines: string[]) {
    super(`SMTP ${code}: ${lines.join(" ")}`);
    this.name = "SmtpError";
    this.code = code;
  }
}

/**
 * Minimal SMTP client (EHLO → optional AUTH LOGIN → MAIL/RCPT/DATA → QUIT).
 * Kept dependency-free so notification delivery cannot introduce supply-chain
 * risk; covered by an in-process fake-SMTP integration test.
 */
export async function sendSmtpMessage(args: {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  password?: string;
  from: string;
  to: string;
  subject: string;
  text: string;
}): Promise<void> {
  const socket = args.secure
    ? tlsConnect({
        host: args.host,
        port: args.port,
        rejectUnauthorized: true,
      })
    : connect({ host: args.host, port: args.port });

  socket.setTimeout(10_000);

  const lines: string[] = [];
  const waiters: Array<(line: string) => void> = [];
  let buffer = "";
  socket.on("data", (chunk) => {
    buffer += chunk.toString("utf8");
    let index: number;
    while ((index = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, index).replace(/\r$/, "");
      buffer = buffer.slice(index + 1);
      const waiter = waiters.shift();
      if (waiter) waiter(line);
      else lines.push(line);
    }
  });
  const readLine = (): Promise<string> =>
    new Promise((resolve, reject) => {
      const buffered = lines.shift();
      if (buffered !== undefined) {
        resolve(buffered);
        return;
      }
      waiters.push(resolve);
      socket.on("error", reject);
      socket.on("timeout", () => reject(new Error("SMTP socket timed out")));
      if (socket.destroyed || !socket.writable) {
        reject(new Error("SMTP socket closed unexpectedly"));
      }
    });

  const sendLine = (line: string): Promise<void> =>
    new Promise((resolve, reject) => {
      if (!socket.writable || socket.destroyed) {
        reject(new Error("SMTP socket not writable"));
        return;
      }
      socket.write(`${line}\r\n`, (error) =>
        error ? reject(error) : resolve(),
      );
    });

  const readReply = async (expectedCodes: number[]): Promise<SmtpReply> => {
    const lines: string[] = [];
    let read = true;
    let code = -1;
    while (read) {
      const raw = await readLine();
      const match = /^(\d{3})([ -])(.*)$/.exec(raw);
      if (!match) throw new Error(`malformed SMTP response: "${raw}"`);
      code = Number(match[1]);
      lines.push(match[3]);
      read = match[2] === "-";
    }
    if (!expectedCodes.includes(code)) throw new SmtpError(code, lines);
    return { code, lines };
  };

  const writeWithCheck = async (
    line: string,
    expected: number[],
  ): Promise<SmtpReply> => {
    await sendLine(line);
    return readReply(expected);
  };

  try {
    await readReply([220]);

    await writeWithCheck(`EHLO ${args.host}`, [250]);

    const credentials = args.user && args.password;
    if (credentials) {
      await writeWithCheck("AUTH LOGIN", [334]);
      await writeWithCheck(
        Buffer.from(args.user as string, "utf8").toString("base64"),
        [334],
      );
      await writeWithCheck(
        Buffer.from(args.password as string, "utf8").toString("base64"),
        [235],
      );
    }

    await writeWithCheck(`MAIL FROM:<${args.from}>`, [250]);
    await writeWithCheck(`RCPT TO:<${args.to}>`, [250, 251]);
    await writeWithCheck("DATA", [354]);

    const body = [
      `From: ${args.from}`,
      `To: ${args.to}`,
      `Subject: ${args.subject}`,
      "Content-Type: text/plain; charset=utf-8",
      "MIME-Version: 1.0",
      "",
      // RFC 5321 dot-stuffing: a leading "." on any line is doubled so it
      // cannot be mistaken for the end-of-data marker.
      args.text.replace(/\r?\n/g, "\r\n").replace(/^\./gm, ".."),
    ].join("\r\n");
    await sendLine(body);
    await sendLine(".");
    await readReply([250]);

    await writeWithCheck("QUIT", [221]);
  } finally {
    socket.destroy();
  }
}

export function createSmtpEmailProvider(args: {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  password?: string;
  from: string;
  sender: (message: {
    host: string;
    port: number;
    secure: boolean;
    user?: string;
    password?: string;
    from: string;
    to: string;
    subject: string;
    text: string;
  }) => Promise<void>;
}): EmailProvider {
  return {
    key: "smtp",
    async send(input): Promise<DeliverResult> {
      try {
        await args.sender({
          host: args.host,
          port: args.port,
          secure: args.secure,
          user: args.user,
          password: args.password,
          from: args.from,
          to: input.to,
          subject: input.subject,
          text: input.text,
        });
        return { ok: true, real: true };
      } catch (error) {
        return {
          ok: false,
          real: true,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  };
}

export function createEmailProviderFromEnv(): EmailProvider {
  const { emailFrom, smtpHost, smtpPort, smtpUser, smtpPassword, smtpSecure } =
    env;
  if (smtpHost && emailFrom) {
    return createSmtpEmailProvider({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      user: smtpUser,
      password: smtpPassword,
      from: emailFrom,
      sender: sendSmtpMessage,
    });
  }
  return logEmailProvider;
}

// ---------------------------------------------------------------------------
// Telegram
// ---------------------------------------------------------------------------

/**
 * Sends a message through the Telegram Bot API. `fetchFn` is injectable for
 * deterministic tests. The bot token is used only inside the request URL —
 * never logged and never returned to callers.
 */
export async function sendTelegramMessage(args: {
  token: string;
  chatId: string;
  text: string;
  fetchFn?: typeof fetch;
}): Promise<DeliverResult> {
  if (!args.token) {
    return {
      ok: false,
      real: false,
      error: "TELEGRAM_BOT_TOKEN is not set; message not sent",
    };
  }
  const fetchFn = args.fetchFn ?? fetch;
  try {
    const response = await fetchFn(
      `https://api.telegram.org/bot${args.token}/sendMessage`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: args.chatId,
          text: args.text,
          disable_web_page_preview: true,
        }),
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!response.ok) {
      let detail = `HTTP ${response.status}`;
      try {
        const body = (await response.json()) as { description?: string };
        detail = body.description ?? detail;
      } catch {
        // keep HTTP status detail
      }
      return { ok: false, real: true, error: `telegram API error: ${detail}` };
    }
    const body = (await response.json()) as { ok?: boolean };
    if (body.ok === false) {
      return { ok: false, real: true, error: "telegram API returned ok=false" };
    }
    return { ok: true, real: true };
  } catch (error) {
    return {
      ok: false,
      real: true,
      error: `telegram request failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export function createTelegramProvider(args: {
  token: string;
  fetchFn?: typeof fetch;
}): TelegramProvider {
  return {
    key: "telegram",
    send(input): Promise<DeliverResult> {
      return sendTelegramMessage({
        token: args.token,
        chatId: input.chatId,
        text: input.text,
        fetchFn: args.fetchFn,
      });
    },
  };
}