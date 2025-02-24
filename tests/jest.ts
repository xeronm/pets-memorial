import { BlockchainTransaction } from '@ton/sandbox';
import { flattenTransaction } from '@ton/test-utils/dist/test/transaction';
import { fromNano } from '@ton/core';
import { Address } from 'ton-core';

export type TransactionDesc = {
    totalFeesLower?: bigint,
    totalFeesUpper?: bigint,
    valueLower?: bigint,
    valueUpper?: bigint,
    from?: Address,
    to?: Address,
    success?: boolean,
    exitCode?: number,
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
        if (tx.success != (txDesc.success ?? true)) {
            pass = false;
            txMessage.push(`success(${tx.success}) != ${txDesc.success ?? true};`);
        }
        if (txDesc.deploy != null && tx.deploy != txDesc.deploy) {
            pass = false;
            txMessage.push(`success(${tx.deploy}) != ${txDesc.deploy};`);
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

try {
    const jestGlobals = require("@jest/globals");

    if (jestGlobals) jestGlobals.expect.extend({
        toHaveTransactionSeq,
    })
} catch (e) {}

declare global {
    export namespace jest {
        interface Matchers<R> {
            toHaveTransactionSeq(cmp: TransactionDesc[]): R
        }
    }
}