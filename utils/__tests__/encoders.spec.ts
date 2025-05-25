import { 
  encodeDateMaskStr, 
  encodeBcd2c, 
  encodeGeoPoint,
  decodeDateMask,
  decodeBcd2c,
  decodeGeoPoint,
  decodeQint
} from '../encoders';
import { toNano } from '@ton/core';

describe('Encoders', () => {

  it('BCD encoded date mask', async () => {
    expect(encodeDateMaskStr('*')).toBe(0x00000000);    
    expect(encodeDateMaskStr('2024')).toBe(0x20240000);
    expect(encodeDateMaskStr('2024-*')).toBe(0x20240000);
    expect(encodeDateMaskStr('2024-10')).toBe(0x20241000);
    expect(encodeDateMaskStr('2024-10-*')).toBe(0x20241000);
    expect(encodeDateMaskStr('2024-10-20')).toBe(0x20241020);    

    expect(decodeDateMask(0)).toBe('*');    
    expect(decodeDateMask(0x20240000)).toBe('2024-*');
    expect(decodeDateMask(0x20241000)).toBe('2024-10-*');
    expect(decodeDateMask(0x20241020)).toBe('2024-10-20');
  });

  it('BCD 5-bits encoded 2-letter english char code', async () => {
    expect(encodeBcd2c('en')).toBe(0x8D);
    expect(encodeBcd2c('EN')).toBe(0x8D);
    expect(encodeBcd2c('ru')).toBe(0x234);
    expect(encodeBcd2c('RU')).toBe(0x234);

    expect(decodeBcd2c(0x8D)).toBe('EN');
    expect(decodeBcd2c(0x234)).toBe('RU');    
  });  

  it('GeoPoint', async () => {
    expect(encodeGeoPoint({
      isSouth: false,
      latitude: 45.046284,
      longitude: 38.981700,
    })).toBe(0x4010d91bb866);

    expect(decodeGeoPoint(0x4010d91bb866)).toStrictEqual({
      isSouth: false,
      latitude: 45.04627346992493,
      longitude: 38.98168087005615,
    });
  });  

  it('QInt', async () => {
    expect(decodeQint(0x31)).toBe(toNano("0.00125"));
    expect(decodeQint(0x34)).toBe(toNano("0.00500"));
    expect(decodeQint(0x38)).toBe(toNano("0.01000"));
    expect(decodeQint(0x3A)).toBe(toNano("0.02500"));
  });  

});
