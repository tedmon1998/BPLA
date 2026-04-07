import { ACTIVATION_CODE_SHA256_HEX } from './activationHash'

async function sha256Hex(text: string): Promise<string> {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export async function verifyActivationCode(input: string): Promise<boolean> {
  const trimmed = input.trim()
  if (!trimmed) {
    return false
  }
  const hash = await sha256Hex(trimmed)
  return hash === ACTIVATION_CODE_SHA256_HEX
}
