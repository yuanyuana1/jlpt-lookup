const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const privateKeyPath = path.join(__dirname, '../keys/license-private.pem');
const publicKeyPath = path.join(__dirname, '../src/main/license-public.pem');

if (fs.existsSync(privateKeyPath) || fs.existsSync(publicKeyPath)) {
  console.error('授权密钥已存在。为避免覆盖，请先备份并手动处理现有密钥。');
  process.exit(1);
}

const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
fs.mkdirSync(path.dirname(privateKeyPath), { recursive: true });
fs.writeFileSync(privateKeyPath, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
fs.writeFileSync(publicKeyPath, publicKey.export({ type: 'spki', format: 'pem' }));
console.log('授权密钥已生成。请离线备份 keys/license-private.pem，且绝不要提交或发送给用户。');