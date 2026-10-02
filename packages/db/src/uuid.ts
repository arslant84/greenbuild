import { randomBytes } from "node:crypto";

const UUID_BYTES = 16;
const TIMESTAMP_BYTES = 6;
const VERSION_7 = 0x70;
const VARIANT_RFC_9562 = 0x80;
const LOW_NIBBLE = 0x0f;
const LOW_SIX_BITS = 0x3f;
const BITS_PER_BYTE = 8;

// uuidv7 returns an RFC 9562 version 7 UUID: 48 bits of Unix milliseconds, then random bits.
// Ids sort by creation time, which keeps primary-key index inserts sequential. PostgreSQL 16
// has no uuidv7() (it arrives in 18), so ids are made here.
export function uuidv7(now: number = Date.now()): string {
  const bytes = randomBytes(UUID_BYTES);
  let millis = BigInt(now);
  for (let index = TIMESTAMP_BYTES - 1; index >= 0; index--) {
    bytes[index] = Number(millis & 0xffn);
    millis >>= BigInt(BITS_PER_BYTE);
  }
  bytes[6] = VERSION_7 | ((bytes[6] ?? 0) & LOW_NIBBLE);
  bytes[8] = VARIANT_RFC_9562 | ((bytes[8] ?? 0) & LOW_SIX_BITS);
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
