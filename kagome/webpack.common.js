const path = require('path');
const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = ({ mode }) => ({
    mode: mode,
    entry: {
        index: './src/index.ts',
        'kagome.min': './src/index.ts'
    },
    output: {
        path: path.resolve('./dist'),
        filename: '[name].js',
        libraryTarget: 'umd',
        library: 'Kagome',
        globalObject: 'this'
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: {
                    loader: 'ts-loader',
                    options:
                        mode == 'development'
                        ? { transpileOnly: true }
                        : {}
                },
                exclude: /node_modules/
            }
        ]
    },
    resolve: {
        extensions: [".ts", ".tsx", ".js"]
    },
    plugins: [
        new webpack.SourceMapDevToolPlugin({
            // .js but not .min.js
            include: /(?<!\.min)\.js/
        })
    ],
    optimization: {
        minimize: true,
        minimizer: [
            new TerserPlugin({
                include: /\.min\.js$/,
                terserOptions: {
                    output: { comments: false }
                },
                extractComments: false
            })
        ]
    }
});