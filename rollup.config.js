import typescript from '@rollup/plugin-typescript';
import {terser} from 'rollup-plugin-terser';
import resolve from '@rollup/plugin-node-resolve';

export default {
    input: 'src/index.ts',
    output: [
        {
            file: 'dist/index.js',
            format: 'umd',
            plugins: [typescript()],
        },
        {
            file: 'dist/kagome.min.js',
            format: 'umd',
            plugins: [typescript(), terser()]
        }
    ],
    plugins: [resolve()]
};
