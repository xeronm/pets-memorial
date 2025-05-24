import { BlockchainTransaction } from '@ton/sandbox';
import { flattenTransaction } from '@ton/test-utils/dist/test/transaction';
import { fromNano, Address, Cell } from '@ton/core';
import { Matchers } from "@jest/expect";


export type TransactionDesc = {
    totalFeesLower?: bigint,
    totalFeesUpper?: bigint,
    valueLower?: bigint,
    valueUpper?: bigint,
    from?: Address,
    to?: Address,
    success?: boolean,
    exitCode?: number,
    actionResultCode?: number,
    deploy?: boolean,
}

export function transactionStringify(txs: BlockchainTransaction[]): string {
    return JSON.stringify(txs, (k, v) => {
        if (['parent', 'children', 'body', 'raw', 'code', 'data', 'bits', 'hash', '_hashes'].indexOf(k) >= 0) {
            return '<...>';
        }
        return typeof v === 'bigint' ? fromNano(v) : v
    });
}

export interface TxAmoutFlow {
    amount: bigint,
    extTotalFees: bigint,
    outValue: bigint,
    inValue: bigint,
    totalFees: bigint,
}

export interface TxReportRecord {
    opCode?: number,
    op?: string,
    from?: string,
    to?: string,
    value?: bigint,
    outActions: number,
    outValue?: bigint,
    totalFees?: bigint,
    totalFwdFees?: bigint,
    computeFee?: bigint,
    storageFees?: bigint,
    exitCode: number,
    outMessages?: {op?: string, opCode?: number, forwardFee?: bigint}[],
    body?: number,
    initCode?: number,
    initData?: number,
}

function extractOp(body: Cell): number | undefined {
    const s = body.beginParse()
    if (s.remainingBits >= 32) {
        return s.loadUint(32)
    } else {
        return undefined
    }
}

export function transactionReport(subject: BlockchainTransaction[], opcodes: {[name: string]: number},
    addrNames: {[name: string]: Address | undefined}): TxReportRecord[]
{
    const opMap = Object.entries(opcodes).reduce((agg, [k, v]) =>
        (agg.set(v, k), agg), new Map<number, string>());
    const addrMap = Object.entries(addrNames).reduce((agg, [k, v]) =>
        (v && agg.set(v.toString(), k), agg), new Map<string, string>());

    const report: TxReportRecord[] = [];
    let i = 0;


    return subject.map(txRaw => {
        if (txRaw.description.type !== 'generic') return undefined;
        const tx = flattenTransaction(txRaw);

        const outMessages = txRaw.outMessages.values()
            .map(m => {
                const op = extractOp(m.body);

                return {
                    opCode: op,
                    op: op ? opMap.get(op) : undefined,
                    forwardFee: (m.info.type === 'internal') ? m.info.forwardFee : undefined,
                }
            });

        return {
            opCode: tx.op,
            op: tx.op ? opMap.get(tx.op) : undefined,
            from: tx.from ? addrMap.get(tx.from.toString()) : undefined,
            to: tx.to ? addrMap.get(tx.to.toString()) : undefined,
            value: tx.value ?? 0n,
            outActions: txRaw.description.actionPhase?.totalActions ?? 0,
            outValue: txRaw.outMessages.values()
                        .reduce((agg, m) => (agg += (m.info.type === 'internal') ? m.info.value.coins : 0n, agg), 0n),
            totalFees: tx.totalFees,
            // inForwardFee: txRaw.inMessage?.info.type === 'internal' ? txRaw.inMessage.info.forwardFee : undefined,
            totalFwdFees: txRaw.description.actionPhase?.totalFwdFees ?? undefined,
            computeFee: txRaw.description.computePhase.type === 'vm' ? txRaw.description.computePhase.gasFees : undefined,
            storageFees: txRaw.description.storagePhase?.storageFeesCollected,
            exitCode: tx.exitCode ?? 0,
            outMessages: outMessages,
            body: tx.body?.bits.length,
            initCode: tx.initCode?.bits.length,
            initData: tx.initData?.bits.length,
        }
    }).filter(x => x !== undefined);
}

export function transactionAmountFlow(subject: BlockchainTransaction[]): TxAmoutFlow | undefined  {
    // TODO: Need check graph traversal, and count only edges `from` -> `to`.
    const flow: TxAmoutFlow = {
        amount: 0n,
        extTotalFees: 0n,
        outValue: 0n,
        inValue: 0n,
        totalFees: 0n,
    };

    if (!subject.length || subject[0].inMessage?.info.type !== 'external-in' ||
        !(subject[0].inMessage.info.dest instanceof Address)) return flow;

    const sender: Address = subject[0].inMessage.info.dest;

    let i = 0;
    for (const txRaw of subject) {
        const tx = flattenTransaction(txRaw);
        flow.totalFees += tx.totalFees ?? 0n;
        if (tx.from?.toString() === sender.toString()) {
            flow.outValue += tx.value ?? 0n;
        }
        if (tx.to?.toString() === sender.toString()) {
            flow.inValue += tx.value ?? 0n;
        }
        if (txRaw.inMessage?.info.type == 'external-in') {
            flow.extTotalFees += tx.totalFees ?? 0n;
        }

        // if ((i > 0) && (txRaw.description.type === 'generic')) {
        //     flow.storageFees += txRaw.description.storagePhase?.storageFeesCollected ?? 0n
        // }
        i += 1;
    }
    flow.amount += flow.outValue - flow.inValue;

    return flow;
}

function toHaveTransactionSeq(subject: BlockchainTransaction[], cmp: TransactionDesc[]) {
    let i = 0;
    let pass = true;
    let messages = [];
    for (const txRaw of subject) {
        const tx = flattenTransaction(txRaw);
        const txDesc = cmp[i];
        const txMessage = [];
        if (!txDesc) continue;

        if ((txDesc.from != undefined) && (tx.from?.toString() != txDesc.from.toString())) {
            pass = false;
            txMessage.push(`from(${tx.from}) != ${txDesc.from};`);
        }
        if ((txDesc.to != undefined) && (tx.to?.toString() != txDesc.to.toString())) {
            pass = false;
            txMessage.push(`to(${tx.to}) != ${txDesc.to};`);
        }
        if ((txDesc.exitCode != undefined) && (tx.exitCode != txDesc.exitCode)) {
            pass = false;
            txMessage.push(`exitCode(${tx.exitCode}) != ${txDesc.exitCode};`);
        }
        if ((txDesc.actionResultCode != undefined) && (tx.actionResultCode != txDesc.actionResultCode)) {
            pass = false;
            txMessage.push(`actionCode(${tx.actionResultCode}) != ${txDesc.actionResultCode};`);
        }
        if (tx.success != (txDesc.success ?? true)) {
            pass = false;
            txMessage.push(`success(${tx.success}) != ${txDesc.success ?? true}; exitCode=${tx.exitCode}`);
        }
        if (txDesc.deploy != null && tx.deploy != txDesc.deploy) {
            pass = false;
            txMessage.push(`success(${tx.deploy}) != ${txDesc.deploy}; exitCode=${tx.exitCode}`);
        }

        if ((txDesc.totalFeesLower != undefined) && ((tx.totalFees === undefined) || (tx.totalFees < txDesc.totalFeesLower))) {
            pass = false;
            txMessage.push(`totalFees(${fromNano(tx.totalFees || 0)}) >= ${fromNano(txDesc.totalFeesLower)};`);
        }
        if ((txDesc.totalFeesUpper != undefined) && ((tx.totalFees === undefined) || (tx.totalFees > txDesc.totalFeesUpper))) {
            pass = false;
            txMessage.push(`totalFees(${fromNano(tx.totalFees || 0)}) <= ${fromNano(txDesc.totalFeesUpper)};`);
        }

        if ((txDesc.valueLower != undefined) && ((tx.value === undefined) || (tx.value < txDesc.valueLower)))
        {
            pass = false;
            txMessage.push(`value(${fromNano(tx.value ?? 0)}) >= ${fromNano(txDesc.valueLower)};`);
        }
        if ((txDesc.valueUpper != undefined) && ((tx.value === undefined) || (tx.value > txDesc.valueUpper)))
            {
                pass = false;
                txMessage.push(`value(${fromNano(tx.value ?? 0)}) <= ${fromNano(txDesc.valueUpper)};`);
            }

        if (txMessage.length) {
            messages.push(`expected TX #${i} mistmatch: `+txMessage.join(' '));
        }
        i++;
    }

    return {
        message: () => messages.join('\n'),
        pass,
    }
}

function toAlmostEqualTons(subject: bigint, cmp: bigint) {
    let diff = subject - cmp;
    if (diff < 0) diff = -diff;
    // @ts-ignore
    if (this.isNot) {
        expect(diff).not.toBeLessThanOrEqual(10n);
    }
    else {
        expect(diff).toBeLessThanOrEqual(10n);
    }
    // @ts-ignore
    return { pass: !this.isNot };
}

try {
    const jestGlobals = require("@jest/globals");

    if (jestGlobals) jestGlobals.expect.extend({
        toHaveTransactionSeq,
        toAlmostEqualTons,
    })
} catch (e) {}

declare global {
    export namespace jest {
        interface Matchers<R> {
            toHaveTransactionSeq(cmp: TransactionDesc[]): R
            toAlmostEqualTons(cmp: bigint): R
        }
    }
}