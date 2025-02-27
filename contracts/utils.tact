// Mapping function signatures from FunC to Tact:
@name(unpack_qint)
native unpackQint(qnum: Int): Int;

@name(date_mask_to_string)
native dateMaskToString(n: Int): String;

@name(bcd2c_to_string)
native bcd2cToString(n: Int): String;


fun randomUint64(): Int {
    return randomInt() & 0xFFFFFFFFFFFFFFFF;
}

fun randomUint32(): Int {
    return randomInt() & 0xFFFFFFFF;
}

inline extends fun asMetadataCell(self: String): Cell {
    return beginTailString().concat(self).toCell();
}