import math

def unpack_qint(qnum: int) -> int:
    qnum &= 0x7F
    if (qnum == 0):
        return 0

    num = ((qnum & 7) * 10)
    if num == 0:
        num = 8
    return (num * pow(10, qnum >> 3)) >> 3


for x in range(17):
    x = (0b11 << 4) + x
    r = round(unpack_qint(x)/1e9, 5)
    print(f';; 0x{x:X} -> {(x >> 3):05b} {(x & 7):03b} -> {r:0.5f} TON')