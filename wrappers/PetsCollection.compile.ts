import { CompilerConfig } from '@ton/blueprint';

export const compile: CompilerConfig = {
    lang: 'tact',
    target: 'contracts/pets_collection.tact',
    options: {
        debug: false,
    },
};
