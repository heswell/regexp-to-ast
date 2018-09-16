import babel from 'rollup-plugin-babel';
import nodeResolve from 'rollup-plugin-node-resolve'

// import replace from 'rollup-plugin-replace'

export default {
    input: 'lib/index.js',
    output: {
        file: 'dist/regexp-to-ast.js',
        format: 'umd',
        name: 'regexp-to-ast',
        sourcemap: false
    },
    plugins: [
        babel({
            exclude: 'node_modules/**'
        }),
        //  replace({ 'process.env.NODE_ENV': JSON.stringify('development') }),
        nodeResolve({
            jsnext: true,
            extensions: ['.js']
        })
    ]
};