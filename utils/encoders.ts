// BCD encoded date mask
// 4 octets - year; 2 Octets - month; 2 octets - day; 0x00 - means unspecified or unknown
//   0x20250100 - means 2025-01-*
//   0x20250000 - means 2025-*
export function decodeDateMask(n: number): string {
  let j = 0;
  const chars = new Array(10);
  if ((n >> 16) & 0xFFFF) {
    let i = 28;
    while (i >= 0) {
      chars[j] = ((n >> i) & 0xF) + 48;
      if (i == 16 || i == 8) {
        j++;
        chars[j] = 45; // '-'          
        if (!((n >> (i-8)) & 0xFF)) {
          i = 0;
          j++;
          chars[j] = 42; // '*'
        }
      }
      j ++;
      i -= 4;
    }

    return String.fromCharCode(...chars.slice(0, j));
  }
  else {
    return '*';
  }
}

// BCD encoded date mask
// 4 octets - year; 2 Octets - month; 2 octets - day; 0x00 - means unspecified or unknown
//   0x20250100 - means 2025-01-*
//   0x20250000 - means 2025-*
export function encodeDateMask(year?: number, month?: number, day?: number): number {
  let bcd: number = 0;

  if (year == null || year < 0 || year > 9999) return bcd;  
  bcd |= ((year / 1000) % 10) << 28; // Thousands
  bcd |= ((year / 100) % 10) << 24;  // Hundreds
  bcd |= ((year / 10) % 10) << 20;   // Tens
  bcd |= (year % 10) << 16;          // Ones

  if (month == null || month < 0 || month > 12) return bcd;  
  bcd |= ((month / 10) % 10) << 12;  // Tens
  bcd |= (month % 10) << 8;           // Ones

  if (day == null || day < 0 || day > 31) return bcd;  
  bcd |= ((day / 10) % 10) << 4;     // Tens
  bcd |= (day % 10);                  // Ones

  return bcd;
}

export function encodeDateMaskStr(mask: string): number {
  const comp = mask.split('-').slice(0, 3).map(x => x == '*' ? 0 : parseInt(x));
  return encodeDateMask(comp[0], comp[1], comp[2]);
}

// BCD 5-bits encoded 2-letter english char code
//  used for ISO 639 two letter language code or ISO 3166-1 alpha-2 code
export function decodeBcd2c(n: number): string {
  return String.fromCharCode(((n >> 5) & 0x1F) + 65, (n & 0x1F) + 65)
}

// BCD 5-bits encoded 2-letter english char code
//  used for ISO 639 two letter language code or ISO 3166-1 alpha-2 code
export function encodeBcd2c(code: string): number {  
  return ((code.charCodeAt(0) - 65) & 0x1F) << 5 | ((code.charCodeAt(1) - 65) & 0x1F);
}

export interface GeoPoint{
  isSouth: boolean, 
  latitude: number, 
  longitude: number
}

export function encodeGeoPoint(point: GeoPoint): number {
  let n = 0n;
  n |= (BigInt(Math.trunc(((1 << 23) * point.latitude) / 90)) & 0x7FFFFFn) << 24n;
  n |= BigInt(Math.trunc(((1 << 24) * point.longitude) / 360)) & 0xFFFFFFn;
  if (point.isSouth) n |= 1n << 47n;
  return Number(n);
}

export function decodeGeoPoint(n: number): GeoPoint {
  const bn = BigInt(n);
  return {
    isSouth: ((bn >> 47n) & 1n) == 1n,
    latitude: Number(((bn >> 24n) & 0x7FFFFFn) * 90n) / Number(1n << 23n),
    longitude: Number((bn & 0xFFFFFFn) * 360n) / Number(1n << 24n)
  };
}
