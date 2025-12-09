// Diffie-Hellman Key Exchange utilities

// Convert hex string to BigInt
export const hexToBigInt = (hex) => {
  return BigInt(hex);
};

// Convert BigInt to hex string
export const bigIntToHex = (bigInt) => {
  return '0x' + bigInt.toString(16);
};

// Generate random private key
export const generatePrivateKey = (p) => {
  // Generate random number between 2 and p-2
  const pBigInt = typeof p === 'string' ? hexToBigInt(p) : p;
  const bitLength = pBigInt.toString(2).length;
  
  let privateKey;
  do {
    // Generate random bytes
    const randomBytes = new Uint8Array(Math.ceil(bitLength / 8));
    crypto.getRandomValues(randomBytes);
    
    // Convert to BigInt
    privateKey = BigInt('0x' + Array.from(randomBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join(''));
    
  } while (privateKey < 2n || privateKey >= pBigInt - 2n);
  
  return privateKey;
};

// Calculate public key: g^privateKey mod p
export const calculatePublicKey = (g, privateKey, p) => {
  const gBigInt = typeof g === 'string' ? hexToBigInt(g) : g;
  const pBigInt = typeof p === 'string' ? hexToBigInt(p) : p;
  const privBigInt = typeof privateKey === 'string' ? hexToBigInt(privateKey) : privateKey;
  
  return modPow(gBigInt, privBigInt, pBigInt);
};

// Calculate shared secret: otherPublicKey^privateKey mod p
export const calculateSharedSecret = (otherPublicKey, privateKey, p) => {
  const otherPubBigInt = typeof otherPublicKey === 'string' ? hexToBigInt(otherPublicKey) : otherPublicKey;
  const pBigInt = typeof p === 'string' ? hexToBigInt(p) : p;
  const privBigInt = typeof privateKey === 'string' ? hexToBigInt(privateKey) : privateKey;
  
  return modPow(otherPubBigInt, privBigInt, pBigInt);
};

// Modular exponentiation: (base^exp) mod mod
export const modPow = (base, exp, mod) => {
  let result = 1n;
  base = base % mod;
  
  while (exp > 0n) {
    if (exp % 2n === 1n) {
      result = (result * base) % mod;
    }
    exp = exp >> 1n;
    base = (base * base) % mod;
  }
  
  return result;
};

// Derive AES key from shared secret using SHA-256
export const deriveAESKey = async (sharedSecret) => {
  const secretBigInt = typeof sharedSecret === 'string' ? hexToBigInt(sharedSecret) : sharedSecret;
  
  // Convert BigInt to bytes
  const hexStr = secretBigInt.toString(16);
  const bytes = new Uint8Array(Math.ceil(hexStr.length / 2));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hexStr.substr(i * 2, 2), 16);
  }
  
  // Hash with SHA-256
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  
  // Import as AES key
  return crypto.subtle.importKey(
    'raw',
    hashBuffer,
    { name: 'AES-CBC' },
    false,
    ['encrypt', 'decrypt']
  );
};

// AES Encryption
export const aesEncrypt = async (plaintext, aesKey) => {
  // Generate random IV
  const iv = crypto.getRandomValues(new Uint8Array(16));
  
  // Convert plaintext to bytes
  const encoder = new TextEncoder();
  const plaintextBytes = encoder.encode(plaintext);
  
  // Encrypt
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-CBC', iv },
    aesKey,
    plaintextBytes
  );
  
  // Convert to base64
  const encryptedArray = new Uint8Array(encryptedBuffer);
  const encryptedBase64 = btoa(String.fromCharCode(...encryptedArray));
  const ivBase64 = btoa(String.fromCharCode(...iv));
  
  return { encrypted: encryptedBase64, iv: ivBase64 };
};

// AES Decryption
export const aesDecrypt = async (encryptedBase64, ivBase64, aesKey) => {
  // Convert from base64
  const encryptedBytes = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(ivBase64), c => c.charCodeAt(0));
  
  // Decrypt
  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-CBC', iv },
    aesKey,
    encryptedBytes
  );
  
  // Convert to string
  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
};
