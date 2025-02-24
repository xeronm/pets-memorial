// Mapping function signatures from FunC to Tact:
@name(unpack_qint)
native unpackQint(qnum: Int): Int;

fun randomUint64(): Int {
    return randomInt() & 0xFFFFFFFFFFFFFFFF;
}

fun randomUint32(): Int {
    return randomInt() & 0xFFFFFFFF;
}