// Quick OAuth test using oauth-1.0a package
require('dotenv').config({ path: '.env.local' });
const OAuth = require('oauth-1.0a');
const crypto = require('crypto');

const apiKey = (process.env.SMUGMUG_API_KEY || '').trim();
const apiSecret = (process.env.SMUGMUG_API_SECRET || '').trim();
const accessToken = (process.env.SMUGMUG_ACCESS_TOKEN || '').trim();
const accessSecret = (process.env.SMUGMUG_ACCESS_SECRET || '').trim();

console.log('API Key:', apiKey.slice(0, 8) + '…');
console.log('Access Token:', accessToken.slice(0, 8) + '…', '(len:', accessToken.length + ')');
console.log('Access Secret len:', accessSecret.length);

const oauth = new OAuth({
  consumer: { key: apiKey, secret: apiSecret },
  signature_method: 'HMAC-SHA1',
  hash_function(base_string, key) {
    return crypto.createHmac('sha1', key).update(base_string).digest('base64');
  },
});

const url = 'https://api.smugmug.com/api/v2!authuser';
const token = { key: accessToken, secret: accessSecret };

const authHeader = oauth.toHeader(oauth.authorize({ url, method: 'GET' }, token));

console.log('\nAuth header:', authHeader.Authorization.slice(0, 80) + '…');
console.log('Calling:', url);

fetch(url, {
  headers: {
    ...authHeader,
    Accept: 'application/json',
  }
})
  .then(r => {
    console.log('Status:', r.status);
    return r.text();
  })
  .then(t => {
    try {
      const j = JSON.parse(t);
      if (j.Response) {
        console.log('✓ Success! User:', j.Response.User?.NickName || JSON.stringify(j.Response).slice(0, 200));
      } else {
        console.log('Response:', JSON.stringify(j, null, 2).slice(0, 500));
      }
    } catch {
      console.log('Raw:', t.slice(0, 300));
    }
  })
  .catch(e => console.error('Error:', e));
