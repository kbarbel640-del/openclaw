/*
Language: Plain text
Author: Egor Rogov ([redacted-email])
Description: Plain text without any highlighting.
Category: common
*/

function plaintext(hljs) {
  return {
    name: 'Plain text',
    aliases: [
      'text',
      'txt'
    ],
    disableAutodetect: true
  };
}

module.exports = plaintext;
