import { crc16, base32Encode, base32Decode } from '@ton/core';

export function adnlIdEncode(id: Buffer, upperCase: boolean = false): string {
  if (id.length != 32) {
    throw new Error("Wrong andl id size");
  }
  const buf = Buffer.alloc(35);
  buf[0] = 0x2d;
  id.copy(buf, 1);
  const hash = parseInt(crc16(buf.subarray(0, 33)).toString('hex'), 16);
  buf[33] = (hash >> 8) & 255;
  buf[34] = hash & 255;
  const encoded = base32Encode(buf).slice(1);
  return upperCase ? encoded.toUpperCase() : encoded;
}

export function adnlIdDecode(id: string): Buffer {
  if (id.length != 55) {
    throw new Error("Wrong length of adnl id");
  }
  const buf = Buffer.alloc(56);
  buf[0] = 0x66;
  Buffer.from(id).copy(buf, 1);
  const decoded = base32Decode(buf.toString('ascii'));
  if (decoded[0] != 0x2d) {
    throw new Error("Invalid first byte");
  }
  const gotHash = (decoded[33] << 8) | decoded[34];
  const hash = parseInt(crc16(decoded.subarray(0, 33)).toString('hex'), 16);
  if (hash != gotHash) {
    throw new Error("Hash mismatch");
  }
  return decoded.subarray(1, 33);
}
