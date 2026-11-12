export function buildGmailRawMessage(toValue: string, subject: string, body: string) {
  const recipients = toValue.split(",").map((recipient) => recipient.trim()).filter(Boolean);
  if (recipients.length === 0 || recipients.length > 20
    || recipients.some((recipient) => !/^[^\s@,<>]+@[^\s@,<>]+\.[^\s@,<>]+$/.test(recipient))) {
    throw new Error("Gmail recipients must contain between 1 and 20 valid comma-separated email addresses.");
  }
  if (!subject.trim() || subject.length > 500 || /[\r\n]/.test(subject)) {
    throw new Error("The Gmail subject is empty or contains invalid line breaks.");
  }
  if (!body.trim() || body.length > 100_000) throw new Error("The Gmail message body is empty or too long.");

  const encodedSubject = (Buffer.from(subject, "utf8").toString("base64").match(/.{1,60}/g) ?? [])
    .map((chunk) => `=?UTF-8?B?${chunk}?=`)
    .join(" ");
  const encodedBody = (Buffer.from(body, "utf8").toString("base64").match(/.{1,76}/g) ?? []).join("\\r\\n");
  const mimeMessage = [
    `To: ${recipients.join(", ")}`,
    `Subject: ${encodedSubject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    encodedBody,
  ].join("\r\n");
  return Buffer.from(mimeMessage, "utf8").toString("base64url");
}
