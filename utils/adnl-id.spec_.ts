
import { adnlIdDecode, adnlIdEncode } from './adnl-id';

const AdnlIdDecoded = '3D94F73794CA3C511C486574BB55A5B7F4F747A4E2ACA618479A77BC841111D1';
const AdnlIdEncoded = 'u6zj5zxstfdyui4jbsxjo2vuw37j52hutrkzjqyi6nhppeecei5cjex';

const AndlId2Base64 = 'kGYfhI+5d44+27ZKj3Z0nAwTtV3alffz+d32DMx9vGk=';
const AdnlId2Encoded = 'wigmh4er64xpdr63o3evd3wosoaye5vlxnjl57t7ho7mdgmpw6gtm3v';

describe('ADNL', () => {

    it('ADNL Encode/Decode', async () => {
        const enc = adnlIdEncode(Buffer.from(AdnlIdDecoded, 'hex'));
        expect(enc).toBe(AdnlIdEncoded);

        const dec = adnlIdDecode(AdnlIdEncoded);
        expect(dec.toString('hex').toUpperCase()).toBe(AdnlIdDecoded);
    });

    it('ADNL base64 encode', async () => {
        const enc = adnlIdEncode(Buffer.from(AndlId2Base64, 'base64'));
        expect(enc).toBe(AdnlId2Encoded);
    });

});

