import resolve from '@rollup/plugin-node-resolve';
import { terser } from "rollup-plugin-terser";

export default {
    input: 'dist/index.js',
    output: [
        {
            file: 'dist/kagome.js',
            format: 'umd',
            name: 'Kagome',
            sourcemap: true
        },
        {
            file: 'dist/kagome.min.js',
            format: 'umd',
            name: 'Kagome',
            sourcemap: true,
            plugins: [terser({
                output: {
                    comments: false
                }
            })]
        }
    ],
    plugins: [resolve()]
};
