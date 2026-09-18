import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:net";
import { once } from "node:events";
import {
  createEmailProviderFromEnv,
  createSmtpEmailProvider,
  createTelegramProvider,
  logEmailProvider,
  sendSmtpMessage,
  sendTelegramMessage,
} from "@/lib/notifications/providers";

describe("sendTelegramMessage", () => {
  const validResponse = new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

  it("returns ok on a successful Bot API reply", async () => {
    let capturedUrl = "";
    let capturedBody = "";
    const fetchFn = async (url: string, init: RequestInit) => {
      capturedUrl = url;
      capturedBody = String(init.body);
      return validResponse;
    };
    const result = await sendTelegramMessage({
      token: "123456:ABC-secret",
      chatId: "123456789",
      text: "مرحباً",
      fetchFn: fetchFn as typeof fetch,
    });
    expect(result).toEqual({ ok: true, real: true });
    expect(capturedUrl).toContain("/bot123456:ABC-secret/sendMessage");
    expect(JSON.parse(capturedBody)).toMatchObject({
      chat_id: "123456789",
      text: "مرحباً",
      disable_web_page_preview: true,
    });
  });

  it("keeps the token out of the body and the returned result", async () => {
    let capturedBody = "";
    const fetchFn = async (url: string, init: RequestInit) => {
      capturedBody = String(init.body);
      void url;
      return validResponse;
    };
    const result = await sendTelegramMessage({
      token: "123456:SUPERSECRET",
      chatId: "1",
      text: "hi",
      fetchFn: fetchFn as typeof fetch,
    });
    expect(capturedBody).not.toContain("SUPERSECRET");
    expect(JSON.stringify(result)).not.toContain("SUPERSECRET");
  });

  it("maps a non-2xx API reply to a failed result", async () => {
    const fetchFn = async () =>
      new Response(JSON.stringify({ description: "bot was blocked" }), { status: 403 });
    const result = await sendTelegramMessage({
      token: "123456:ABC",
      chatId: "1",
      text: "hi",
      fetchFn: fetchFn as typeof fetch,
    });
    expect(result.ok).toBe(false);
    expect(result.real).toBe(true);
    expect(result.error).toContain("bot was blocked");
  });

  it("maps network errors to a failed result without throwing", async () => {
    const fetchFn = async () => {
      throw new Error("network down");
    };
    const result = await sendTelegramMessage({
      token: "123456:ABC",
      chatId: "1",
      text: "hi",
      fetchFn: fetchFn as typeof fetch,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("network down");
  });

  it("fails safely when no token is configured", async () => {
    const result = await sendTelegramMessage({
      token: "",
      chatId: "1",
      text: "hi",
      fetchFn: (async () => validResponse) as typeof fetch,
    });
    expect(result.ok).toBe(false);
    expect(result.real).toBe(false);
  });
});

describe("createTelegramProvider", () => {
  it("builds a provider that routes through the request URL only", async () => {
    const calls: string[] = [];
    const provider = createTelegramProvider({
      token: "tok",
      fetchFn: (async (url: string) => {
        calls.push(url);
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }) as typeof fetch,
    });
    const result = await provider.send({ chatId: "42", text: "x" });
    expect(result.ok).toBe(true);
    expect(calls[0]).toContain("/bottok/sendMessage");
  });
});

describe("logEmailProvider", () => {
  it("reports real:false so skipped delivery is never claimed as sent", async () => {
    const result = await logEmailProvider.send({
      to: "user@example.com",
      subject: "test",
      text: "body",
    });
    expect(result).toMatchObject({ ok: true, real: false });
  });
});

describe("sendSmtpMessage against a fake SMTP server", () => {
  let server: Server;
  let port = 0;
  const received: {
    from?: string;
    to?: string;
    subject?: string;
    body?: string;
  } = {};

  function startFakeSmtp(): Promise<number> {
    received.from = undefined;
    received.to = undefined;
    received.subject = undefined;
    received.body = undefined;
    server = createServer((socket) => {
      socket.write("220 fake.local ESMTP ready\r\n");
      let inData = false;
      let dataLines: string[] = [];
      let authStage = -1;
      socket.on("data", (chunk) => {
        const lines = chunk.toString("utf8").split("\r\n");
        for (const line of lines) {
          if (!line) continue;
          if (inData) {
            if (line === ".") {
              received.body = dataLines.join("\n");
              socket.write("250 OK queued\r\n");
              inData = false;
              continue;
            }
            const colon = line.indexOf(":");
            if (colon > 0) {
              const key = line.slice(0, colon).trim().toLowerCase();
              const value = line.slice(colon + 1).trim();
              if (key === "subject") received.subject = value;
              if (key === "from") received.from = value;
              if (key === "to") received.to = value;
            }
            dataLines.push(line);
            continue;
          }
          const upper = line.toUpperCase();
          if (upper.startsWith("EHLO")) {
            socket.write("250-fake.local\r\n250 AUTH LOGIN PLAIN\r\n");
          } else if (upper.startsWith("AUTH")) {
            authStage = 0;
            socket.write("334 VXNlcm5hbWU6\r\n");
          } else if (
            /^[A-Za-z0-9+/=]+$/.test(line) &&
            !/[:<>]/.test(line) &&
            authStage >= 0
          ) {
            if (authStage === 0) {
              authStage = 1;
              socket.write("334 UGFzc3dvcmQ6\r\n");
            } else {
              authStage = -1;
              socket.write("235 Authentication successful\r\n");
            }
          } else if (upper.startsWith("MAIL FROM")) {
            socket.write("250 OK\r\n");
          } else if (upper.startsWith("RCPT TO")) {
            socket.write("250 OK\r\n");
          } else if (upper.startsWith("DATA")) {
            socket.write("354 End data with <CR><LF>.<CR><LF>\r\n");
            inData = true;
            dataLines = [];
          } else if (upper.startsWith("QUIT")) {
            socket.write("221 Bye\r\n");
            socket.end();
          }
        }
      });
    });
    server.listen(0, "127.0.0.1");
    return once(server, "listening").then(() => {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("no port");
      return address.port;
    });
  }

  beforeEach(async () => {
    port = await startFakeSmtp();
  });

  afterEach(async () => {
    if (server && server.listening) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("delivers an envelope over a real SMTP conversation", async () => {
    await sendSmtpMessage({
      host: "127.0.0.1",
      port,
      secure: false,
      from: "alerts@example.com",
      to: "user@example.com",
      subject: "تحديث نموذج",
      text: "مرحباً بالعالم",
    });
    expect(received.from).toBe("alerts@example.com");
    expect(received.to).toBe("user@example.com");
    expect(received.subject).toBe("تحديث نموذج");
    expect(received.body).toContain("مرحباً بالعالم");
    expect(received.body).toContain("Subject: تحديث نموذج");
  });

  it("supports AUTH LOGIN with base64 credentials", async () => {
    await sendSmtpMessage({
      host: "127.0.0.1",
      port,
      secure: false,
      user: "alerts",
      password: "s3cret",
      from: "alerts@example.com",
      to: "user@example.com",
      subject: "auth check",
      text: "hello",
    });
    expect(received.from).toBe("alerts@example.com");
    expect(received.subject).toBe("auth check");
  });

  it("rejects cleanly when the port is not an SMTP server", async () => {
    const closed = createServer();
    closed.listen(0, "127.0.0.1");
    await once(closed, "listening");
    const deadAddress = closed.address();
    const deadPort =
      typeof deadAddress === "object" && deadAddress ? deadAddress.port : 1;
    await new Promise<void>((resolve) => closed.close(() => resolve()));

    await expect(
      sendSmtpMessage({
        host: "127.0.0.1",
        port: deadPort,
        secure: false,
        from: "a@example.com",
        to: "b@example.com",
        subject: "x",
        text: "y",
      }),
    ).rejects.toThrow();
  });
});

describe("email providers from env / smtp wrapper", () => {
  it("reports real delivery when the injected sender succeeds", async () => {
    const sent: string[] = [];
    const provider = createSmtpEmailProvider({
      host: "smtp.example.com",
      port: 587,
      secure: false,
      from: "alerts@example.com",
      sender: async (message) => {
        sent.push(`${message.from}->${message.to}: ${message.subject}`);
      },
    });
    const result = await provider.send({
      to: "x@example.com",
      subject: "تحديث",
      text: "نص",
    });
    expect(result).toMatchObject({ ok: true, real: true });
    expect(sent[0]).toContain("alerts@example.com->x@example.com: تحديث");
  });

  it("surfaces sender failures as a failed result instead of throwing", async () => {
    const provider = createSmtpEmailProvider({
      host: "smtp.example.com",
      port: 587,
      secure: false,
      from: "alerts@example.com",
      sender: async () => {
        throw new Error("450 mailbox busy");
      },
    });
    const result = await provider.send({
      to: "x@example.com",
      subject: "تحديث",
      text: "نص",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("mailbox busy");
  });

  it("resolves to the honest log-only provider when SMTP is unconfigured", () => {
    const provider = createEmailProviderFromEnv();
    expect(provider.key).toBe("log");
    expect(provider.send).toBeDefined();
  });
});