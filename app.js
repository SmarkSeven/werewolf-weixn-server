const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');  
const bodyParser = require('body-parser');
const request = require('request');
const xmlparser = require('express-xml-bodyparser');
const multer = require('multer'); 
const express = require('express');
const AV = require('leancloud-storage');
const winston = require('winston');
const rotateFile = require('winston-daily-rotate-file');
const sign = require('./src/sign.js');


// leancloud
const LEANCLOUD_APPID = 'c6KKhCV5q3k4B4NBemy5KIwJ-gzGzoHsz';
const LEANCLOUD_APPKEY = 'ams2UmcHwhie8y4cq2FeV4qD';
AV.init({ LEANCLOUD_APPID, LEANCLOUD_APPKEY });

// winston 
const logPath = './logs';
if (!fs.existsSync(logPath)) {
  mkdirp.sync(logPath);
}
const logger = new (winston.Logger)({
  transports: [
    new (winston.transports.Console)(),
    new (rotateFile)({ 
      name: 'info',
      level: 'info',
      datePattern: 'yyyy-MM-dd',
      filename: path.join(logPath, "info.log.")
    }),
    new (rotateFile)({ 
      name: 'error',
      level: 'error',
      datePattern: 'yyyy-MM-dd',
      filename: path.join(logPath, "error.log.")
    }),
  ],
  exceptionHandlers: [
    new (rotateFile)({ 
      name: 'exception',
      datePattern: 'yyyy-MM-dd',
      filename: path.join(logPath, "exception.log."),
      handleExceptions: true,
      humanReadableUnhandledException: true
    }),
  ],
  exitOnError: false
});

const app = express();
app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true }));
app.use(xmlparser()); // 添加XML解析插件

const TOKEN = 'werewolf-kill';
const APPSECRET = 'e206aaef01ed6e738d46a9deeb4cc15a';
const APPID = 'wx4e95556bd902571e';

let Access_Token = '';
let Access_Token_Expires = 0;
let Jsapi_Ticket = '';

let Web_Access_Token = '';
let Web_Refresh_Token = '';

function sha1(str) {
  let hash = crypto.createHash('sha1');
  hash.update(str);
  return hash.digest('hex');
}
// 获取access_token并缓存
function getAccessToken() {
  let accessTokenUrl = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${APPID}&secret=${APPSECRET}`
  https.get(accessTokenUrl, (res) => {
    res.setEncoding('utf8');
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    res.on('end', () => {
      let result = JSON.parse(data);
      if (undefined !== result.errcode) {
      // 记录错误日志 errmsg
        console.log(result.errmsg);
        return ;
      }
      Access_Token = result.access_token;
      Access_Token_Expires = result.expires_in;
      // 在Access_Token失效之前刷新
      setTimeout(getAccessToken, (Access_Token_Expires  -120) * 1000);
      getJsapiTicket(Access_Token)
    });
  });
}

// 获ticket并缓存
function getJsapiTicket(token) {
  let ticketUrl = `https://api.weixin.qq.com/cgi-bin/ticket/getticket?access_token=${Access_Token}&type=jsapi`;
  https.get(ticketUrl, (resp) => {
    resp.setEncoding('utf8');
    let data = '';
    resp.on('data', (chunk) => {
      data += chunk;
    });
    resp.on('end', () => {
      let res = JSON.parse(data);
      if (0 !== res.errcode) {
      // 记录错误日志 errmsg
        console.log(res.errmsg);
        return ;
      }
      Jsapi_Ticket = res.ticket;
    });
  });
}

// 创建用户账户
// function newUser(openid) {
//   AV.User.signUpOrlogInWithAuthData({
//       openid,
//       "access_token": Access_Token,
//       "expires_at": Access_Token_Expires
//   }, 'weixin').then(function (user) {
//     console.log('用户：', useer);
//   }, function (e) {
//     // TODO 记录日志
//     console.log(e);
//   });
// }
// function newUser(openid) {
//   AV.User.signUpOrlogInWithAuthData({
//       openid,
//       "access_token": 'fM0Ua41DZwvsqAAucCKugpRkt7V2PJBv-XNuyU0qZcErg4lmz603nOe5XfsVEjJHDbJy5XBnkRBpAU6sGe9QNA4trh-X3pp_qnV7Pm-u6YM',
//       "expires_at": new Date(new Date + 7200 * 1000).toISOString()
//   }, 'weixin').then(function (user) {
//     console.log('用户：', user);
//   }, function (e) {
//     // TODO 记录日志
//     console.log(e);
//   });
// }

// 获取 Access_Token 和 Jsapi_Ticket
getAccessToken();
// 静态资源服务
// app.use('/', express.static('./dist'))

// 微信公众号接入
app.get('/werewolf/access', (req, res) => {
  let rs = '';
  let signature = req.query.signature;
  let timestamp = req.query.timestamp;
  let nonce = req.query.nonce;
  let echostr = req.query.echostr;

  // 1. 将token、timestamp、nonce三个参数进行字典序排序
  // 2. 将三个参数字符串拼接成一个字符串进行sha1加密
  let str = [timestamp, nonce, TOKEN].sort().join('');
  if (sha1(str) === signature) {
    res.send(echostr);
  } else {
    res.send('Something error!');
  }
});

// 处理关注公众号事件
app.post('/werewolf/access', (req, res) => {
  res.send('');
  let xmldata = req.body.xml;
  if (xmldata.event[0] === 'subscribe') {
    // 用户openId
    const openId = xmldata.fromusername[0];
    // // 获取用户信息
    // const userInfoUrl = `https://api.weixin.qq.com/cgi-bin/user/info?access_token=${Access_Token}&openid=${openId}&lang=zh_CN`;
    // https.get(userInfoUrl, (resp) => {
    //   resp.setEncoding('utf8');
    //   let data = '';
    //   resp.on('data', (chunk) => {
    //     data += chunk;
    //   });
    //   resp.on('end', () => {
    //     let result = JSON.parse(data);
    //     if (result.errcode) {
    //     // 记录错误日志 errmsg
    //       console.log(result.errmsg);
    //       return ;
    //     }
    //     // 注册账户
    //     newUser(result);
    //   });
    // });
  }
});

// 获取jssdk签名
app.get('/werewolf/jssdk/sign', (req, res) => {
  let url = unescape(req.query.url);
  if (Jsapi_Ticket === '') {
    res.json({
      errcode: 101,
      errmsg: 'invalid jsapi_ticket!'
    });
    return;
  }
  if (undefined === url) {
    res.json({
      errcode: 101,
      errmsg: 'url cont\'t be undefined!'
    });
    return;
  }
  res.json(sign(Jsapi_Ticket, url));
});

// 网页微信用户信息
app.get('/werewolf/weixinUserinfo', (req, res) => {
  const code = req.query.code;
  console.log('code', code);
  
  const url = `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${APPID}&secret=${APPSECRET}&code=${code}&grant_type=authorization_code`
  request(url, (error, response, body) => {
    if (error) {
      // todo记录日志
      console.log(error);
      return;
    }
    const data = JSON.parse(body);
    const token = data.access_token;
    // const url = `https://api.weixin.qq.com/sns/userinfo?access_token=${token}&openid=${data.openid}&lang=zh_CN`;
    // request(url, (error, response, body) => {
    //   if (error) {
    //     // todo记录日志
    //     console.log(error);
    //     return;
    //   }
    //   const userinfo = JSON.parse(body);
    //   userinfo.token = token;
    //   console.log('用户信息：', userinfo);
    //   res.json(userinfo);
    // });
    
    // 通过基础接口凭证 Access_Token 获取用户信息
    // 避免网页授权凭证 access_Token 被消费
    const url = `https://api.weixin.qq.com/cgi-bin/user/info?access_token=${Access_Token}&openid=${data.openid}&lang=zh_CN`;
    request(url, (error, response, body) => {
      if (error) {
        // todo记录日志
        console.log(error);
        return;
      }
      const userinfo = JSON.parse(body);
      if (userinfo.errcode) {
        console.log(userinfo.errmsg);
      }
      userinfo.token = token;
      res.json(userinfo);
    });
  });
});

// 启动服务
var server = app.listen(3000, function () {
  var host = server.address().address;
  var port = server.address().port;
  logger.info('listen@ %s:%s', host, port);
});