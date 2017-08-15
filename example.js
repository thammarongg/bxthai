var BxthaiApi = require('./dist/bxthai.js');

var Bxthai = new BxthaiApi();

Bxthai.ticker(console.log);