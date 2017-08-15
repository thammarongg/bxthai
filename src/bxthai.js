import querystring from 'querystring';
import https from 'https';
import _ from 'lodash';
import crypto from 'crypto';

module.exports = class Bxthai {
    constructor(key = '', secret = '', twofa = '') {
        this.key = key;
        this.secret = secret;
        this.twofa = twofa;
    }

    // make API calling method
    _request(handler, options, data, callback) {
        let req = handler.request(options, function(res) {
            res.setEncoding('utf8');
            let buffer = '';
            res.on('data', function(data) {
                buffer += data;
            });
            res.on('end', function() {
                if (buffer === '401 Unauthorized\n') {
                    return callback('API error: 401 Unauthorized');
                }

                if (_.isEmpty(buffer)) {
                    return callback('BX return empty response');
                }

                let json;
                try {
                    json = JSON.parse(buffer);
                } catch (err) {
                    return callback(err);
                }

                if ('error' in json) {
                    return callback(`API error: ${json.error}`);
                }

                return callback(null, json);
            });
        });
        req.on('error', function(err) {
            callback(err);
        });
        req.end(data);
    }

    // bx.in.th public API requestor
    _publicApiRequest(method, params, callback) {
        let options = {
            host: 'bx.in.th',
            path: `/api/${method}/?${querystring.stringify(params)}`,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/4.0 (compatible; bx.in.th node.js client)'
            }
        };

        this._request(https, options, null, callback);
    }

    //
    //  Public APIs
    //
    ticker(callback) {
        this._publicApiRequest('', {}, callback);
    }

    pairings(callback) {
        this._publicApiRequest('pairing', {}, callback);
    }

    orderbook(pairing, callback) {
        this._publicApiRequest('orderbook', {pairing: pairing}, callback);
    }

    trades(pairing, callback) {
        // set default pairing if pairing is undefined
        if (!pairing) {
            pairing = 1;
        }
        this._publicApiRequest('trade', {pairing: pairing}, callback);
    }

    historydata(pairing, since, callback) {
        this._publicApiRequest('tradehistory', {
            pairing: pairing,
            date: since
        }, callback);
    }

    // bx.in.th private API requestor
    _privateApiRequest(method, params, callback) {
        if (!this.key || !this.secret) {
            throw 'Must provide key and secret to make Private API requests';
        }

        if (!_.isArray(params)) {
            throw 'Params need to be an array with parameters in the order they are listed in the API docs.';
        }

        if (!_.isFunction(callback)) {
            callback = function() {};
        }

        let nonce = new Date() * 1000;
        let qs = this.key + nonce + this.secret;

        let signer = crypto.createHash('sha256');
        let hmac = signer.update(qs).digest('hex');
        let signature = new Buffer(hmac).toString();

        let opts = Object.assign({}, {
            key: this.key,
            signature: signature,
            nonce: nonce
        }, params);

        if (this.twofa !== '') {
            opts.twofa = this.twofa;
        }

        let body = JSON.stringify(opts, null, 4);

        let options = {
            host: 'bx.in.th',
            path: `/api/${method}/?${querystring.stringify(params)}`,
            method: 'POST',
            headers: {
                'User-Agent': 'Mozilla/4.0 (compatible; Bitexthai node.js client)',
                'Content-Length': body.length
            }
        };

        this._request(https, options, body, callback);
    }

    //
    //  Private APIs
    //
    createOrder(pairing, type, amount, rate, callback) {
        this._privateApiRequest('order', {
            pairing: pairing,
            type: type,
            amount: amount,
            rate: rate
        }, callback);
    }

    cancelOrder(pairing, orderId, callback) {
        if (orderId.constructor == Array) {
            if (orderId.length > 10) {
                throw 'Current limit of orders per cancelation request is 10';
            }
            orderId = orderId.toString();
        }

        this._privateApiRequest('cancel', {
            pairing: pairing,
            order_id: orderId
        }, callback);
    }

    getBalances(callback) {
        this._privateApiRequest('balance', {}, callback);
    }

    getOrders(pairing = -1, type = 'hold', callback) {
        let params = {};

        if (pairing !== -1) {
            params.pairing = pairing;
        }
        if (type !== 'hold') {
            params.type = type;
        }

        this._privateApiRequest('getorders', params, callback);
    }

    transactionHistory(currency = 'BTC', 
    type = 'fee', 
    startDate = '2017-08-01 08:00:00', 
    endDate = '2017-08-01 08:00:00', 
    callback) {
        this._privateApiRequest('history', {
            currency: currency,
            type: type,
            start_date: startDate,
            end_date: endDate
        }, callback);
    }

    depositAddress(currency, genNew = false, callback) {
        this._privateApiRequest('deposit', {
            currency: currency,
            new: genNew
        }, callback);
    }

    requestWithdrawal(currency, amount, address, bankId) {
        let params = {
            currency: currency,
            amount: amount,
            address: address
        };

        if (bankId !== '') {
            params.bank_id = bankId;
        }

        this._privateApiRequest('withdrawal', params, callback);
    }

    withdrawalHistory(callback) {
        this._privateApiRequest('withdrawal-history', {}, callback);
    }
};