import CryptoJS from 'crypto-js'

const KEY = process.env.ENCRYPTION_KEY ?? 'default-key-change-in-production!!'

export function encrypt(text: string): string {
  return CryptoJS.AES.encrypt(text, KEY).toString()
}

export function decrypt(ciphertext: string): string {
  return CryptoJS.AES.decrypt(ciphertext, KEY).toString(CryptoJS.enc.Utf8)
}
