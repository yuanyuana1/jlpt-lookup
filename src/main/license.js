const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const LICENSE_SCHEMA_VERSION = 1;

function createSigningPayload(license) {
  return JSON.stringify({
    schemaVersion: license.schemaVersion,
    licenseId: license.licenseId,
    customerName: license.customerName,
    issuedAt: license.issuedAt,
    entitlement: license.entitlement
  });
}

function getPublicKey() {
  return fs.readFileSync(path.join(__dirname, 'license-public.pem'), 'utf8');
}

function getLicensePath() {
  const { getUserDataPath } = require('./paths');
  return getUserDataPath('license.jlptlicense');
}

function getInvalidStatus(message) {
  return { valid: false, message };
}

function verifyLicenseDocument(license, publicKey = getPublicKey()) {
  if (!license || typeof license !== 'object') return getInvalidStatus('授权文件格式无效。');

  const { schemaVersion, licenseId, customerName, issuedAt, entitlement, signature } = license;
  if (schemaVersion !== LICENSE_SCHEMA_VERSION ||
      typeof licenseId !== 'string' || !licenseId ||
      typeof customerName !== 'string' || !customerName ||
      typeof issuedAt !== 'string' || Number.isNaN(Date.parse(issuedAt)) ||
      entitlement !== 'personal-lifetime' ||
      typeof signature !== 'string' || !signature) {
    return getInvalidStatus('授权文件内容无效。');
  }

  try {
    const isValid = crypto.verify(
      null,
      Buffer.from(createSigningPayload(license)),
      publicKey,
      Buffer.from(signature, 'base64')
    );
    if (!isValid) return getInvalidStatus('授权文件签名无效。');
  } catch (error) {
    return getInvalidStatus('授权文件无法验证。');
  }

  return {
    valid: true,
    licenseId,
    customerName,
    issuedAt,
    entitlement,
    message: '已激活：个人终身授权'
  };
}

function getLicenseStatus() {
  const licensePath = getLicensePath();
  if (!fs.existsSync(licensePath)) return getInvalidStatus('尚未导入授权文件。');

  try {
    return verifyLicenseDocument(JSON.parse(fs.readFileSync(licensePath, 'utf8')));
  } catch (error) {
    return getInvalidStatus('授权文件无法读取。');
  }
}

function importLicenseFile(filePath) {
  try {
    const license = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const status = verifyLicenseDocument(license);
    if (!status.valid) return status;

    fs.writeFileSync(getLicensePath(), `${JSON.stringify(license, null, 2)}\n`, 'utf8');
    return status;
  } catch (error) {
    return getInvalidStatus('无法导入授权文件。');
  }
}

module.exports = { createSigningPayload, getLicenseStatus, importLicenseFile, verifyLicenseDocument };