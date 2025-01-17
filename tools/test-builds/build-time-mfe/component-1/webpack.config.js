const path = require('path')

module.exports = {
  entry: './index.js',
  output: {
    filename: 'index.js',
    path: path.resolve(__dirname, 'dist'),
    library: {
      name: 'component-1',
      type: 'umd'
    }
  },
  resolve: {
    extensions: ['.ts', '.js']
  }
}
