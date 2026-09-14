const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { createSigningPayload } = require('../src/main/license');

function getArgument(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? '' : process.argv[index + 1] || '';
}

const customerName = getArgument('customer').trim();
const licenseId = getArgument('id').trim();
if (!customerName || !licenseId) {
  console.error('用法: node scripts/issue-license.js --customer "买家昵称或订单号" --id "JL-20260914-001"');
  process.exit(1);
}

const privateKeyPath = path.join(__dirname, '../keys/license-private.pem');
if (!fs.existsSync(privateKeyPath)) {
  console.error('未找到私钥。请先运行: node scripts/generate-license-keypair.js');
  process.exit(1);
}

const license = {
  schemaVersion: 1,
  licenseId,
  customerName,
  issuedAt: new Date().toISOString(),
  entitlement: 'personal-lifetime'
};
license.signature = crypto.sign(null, Buffer.from(createSigningPayload(license)), fs.readFileSync(privateKeyPath, 'utf8')).toString('base64');

const outputDir = path.join(__dirname, '../issued-licenses');
fs.mkdirSync(outputDir, { recursive: true });
const outputPath = path.join(outputDir, `${licenseId}.jlptlicense`);
fs.writeFileSync(outputPath, `${JSON.stringify(license, null, 2)}\n`, 'utf8');
console.log(`授权文件已生成: ${outputPath}`);