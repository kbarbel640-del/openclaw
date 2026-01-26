#!/usr/bin/env node
/**
 * Make outbound calls via Twilio
 * 
 * Usage: node call.js --to "+14155551234" --message "Hello" [--webhook "https://..."]
 * 
 * Environment:
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_PHONE_NUMBER
 */

const https = require('https');

const config = {
  accountSid: process.env.TWILIO_ACCOUNT_SID,
  authToken: process.env.TWILIO_AUTH_TOKEN,
  from: process.env.TWILIO_PHONE_NUMBER,
};

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--?/, '');
    opts[key] = args[i + 1];
  }
  return opts;
}

function makeCall(to, twiml, statusCallback) {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({
      To: to,
      From: config.from,
      Twiml: twiml,
    });
    
    if (statusCallback) {
      params.append('StatusCallback', statusCallback);
      params.append('StatusCallbackEvent', 'initiated ringing answered completed');
    }

    const auth = Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64');
    
    const req = https.request({
      hostname: 'api.twilio.com',
      port: 443,
      path: `/2010-04-01/Accounts/${config.accountSid}/Calls.json`,
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode >= 400) {
            reject(new Error(`Twilio error ${res.statusCode}: ${json.message || data}`));
          } else {
            resolve(json);
          }
        } catch (e) {
          reject(new Error(`Parse error: ${data}`));
        }
      });
    });
    
    req.on('error', reject);
    req.write(params.toString());
    req.end();
  });
}

async function main() {
  const opts = parseArgs();
  
  if (!opts.to) {
    console.error('Usage: node call.js --to "+14155551234" --message "Hello" [--webhook "https://..."]');
    process.exit(1);
  }
  
  if (!config.accountSid || !config.authToken || !config.from) {
    console.error('Missing env vars: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER');
    process.exit(1);
  }
  
  const message = opts.message || 'Hello, this is a call from your AI assistant.';
  const twiml = `<Response><Say voice="alice">${message}</Say></Response>`;
  
  console.log(`Calling ${opts.to}...`);
  
  try {
    const result = await makeCall(opts.to, twiml, opts.webhook);
    console.log('Call initiated:', {
      sid: result.sid,
      status: result.status,
      to: result.to,
      from: result.from,
    });
  } catch (err) {
    console.error('Call failed:', err.message);
    process.exit(1);
  }
}

main();
