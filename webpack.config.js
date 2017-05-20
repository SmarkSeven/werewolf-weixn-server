var webpack = require('webpack');
var HtmlWebpackPlugin = require('html-webpack-plugin');
var ExtractTextPlugin = require('extract-text-webpack-plugin');

module.exports = {
  devtool: 'eval-source-map',//配置生成Source Maps，选择合适的选项
  entry:  __dirname + "/src/main.js",//唯一入口文件
  output: {
    path: __dirname + "/static",//打包后的文件存放的地方
    filename: "[name]-[hash].js"//打包后输出文件的文件名
  },
  module: {//在配置文件里添加JSON loader
    loaders: [
      {
        test: /\.json$/,
        loader: "json"
      },
      {
        test: /\.js$/,
        exclude: /node_modules/,
        loader: 'babel-loader',//在webpack的module部分的loaders里进行配置即可
      },
      {
        test: /\.css$/,
        loader: 'style!css?modules!postcss'//添加对样式表的处理
      }
    ]
  },
  plugins: [
    new webpack.LoaderOptionsPlugin({
      options: {
        postcss: function() {
          return [require('autoprefixer')];
        },
      }
    }),
    new HtmlWebpackPlugin({
      template: __dirname + "/index.tmpl.html"//new 一个这个插件的实例，并传入相关的参数
    }),
    new webpack.optimize.UglifyJsPlugin(),
    new ExtractTextPlugin("[name]-[hash].css")
  ],
  devServer: {
    contentBase: "./static",//本地服务器所加载的页面所在的目录
    historyApiFallback: true,//不跳转
    inline: true,//实时刷新
    hot: true
  },
}