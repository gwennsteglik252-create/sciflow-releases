const https = require('https');

// 通过 electron 的 localstorage 往往在 ~/.config/SciFlow/ 或者直接保存在浏览器 localstorage 中
// 由于这是在一个 electron 开发环境中跑的，我们可以尝试直接调用 google api 做个极简的文本生成测试。

const apiKeyStr = process.argv[2]; // we will ask the user or just instruct the user how to test it.
