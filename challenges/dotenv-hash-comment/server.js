// The shop's payment webhook receiver: records a payment only when the provider's signature matches.
require("dotenv").config({ path: process.env.APP_ENV_FILE });
const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");

const secret = process.env.WEBHOOK_SECRET ?? "";

function signatureMatches(body, given) {
  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
  return given.length === expected.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

http
  .createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => (body += chunk));
    request.on("end", () => {
      if (!signatureMatches(body, String(request.headers["x-signature"] ?? ""))) {
        console.log(`${new Date().toISOString()} rejected webhook: signature mismatch`);
        response.writeHead(401).end("signature mismatch\n");
        return;
      }
      fs.appendFileSync(process.env.PAID_LOG, `${body}\n`);
      console.log(`${new Date().toISOString()} payment recorded: ${body}`);
      response.writeHead(200).end("ok\n");
    });
  })
  .listen(Number(process.env.PORT), "127.0.0.1");
