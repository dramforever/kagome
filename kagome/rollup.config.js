import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { terser } from "rollup-plugin-terser";

export default {
    input: 'dist/index.js',
    output: [
        {
            file: 'dist/kagome.js',
            format: 'umd',
            name: 'Kagome'
        },
        {
            file: 'dist/kagome.min.js',
            format: 'umd',
            name: 'Kagome',
            plugins: [terser()]
        }
    ],
    plugins: [resolve(), commonjs()]
};
