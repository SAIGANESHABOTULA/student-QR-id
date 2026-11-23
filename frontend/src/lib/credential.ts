/**
 * On-device verification of SecureID credentials.
 *
 * Token: SID1.<base64url(payload)>.<base64url(ed25519 signature)>
 * The public key and revocation list are cached locally so a guard can keep
 * verifying cards when the network (or the free-tier server) is unavailable.
 */
import * as ed from '@noble/ed25519'
import { api, type PublicKey, type Revocations, type VerifyResult } from './api'

export interface Claims {
  sid: string
  roll: string
  name: string
  dept: string
  prog: string
  yr: number
  exp: string
  cv: number
  kid: string
  iat: number
}

export interface Decoded { claims: Claims; payload: Uint8Array; signature: Uint8Array; raw: string }

export interface LocalVerdict {
  result: VerifyResult
  claims: Claims | null
  checkedAt: number
  revocationsAge: number | null // ms since the revocation list was fetched
}

const KEY_CACHE = 'sid.pubkey'
const REV_CACHE = 'sid.revocations'

function b64uToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)
  const bin = atob(b64)
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

export function decodeToken(raw: string): Decoded | null {
  const parts = raw.trim().split('.')
  if (parts.length !== 3 || parts[0] !== 'SID1') return null
  try {
    const payload = b64uToBytes(parts[1])
    const signature = b64uToBytes(parts[2])
    const claims = JSON.parse(new TextDecoder().decode(payload)) as Claims
    if (typeof claims !== 'object' || !claims?.sid) return null
    return { claims, payload, signature, raw: raw.trim() }
  } catch {
    return null
  }
}

function readCache<T>(key: string): (T & { _fetchedAt: number }) | null {
  try {
    const v = localStorage.getItem(key)
    return v ? JSON.parse(v) : null
  } catch {
    return null
  }
}
function writeCache(key: string, value: object) {
  try { localStorage.setItem(key, JSON.stringify({ ...value, _fetchedAt: Date.now() })) } catch { /* ignore */ }
}

export const cachedKey = () => readCache<PublicKey>(KEY_CACHE)
export const cachedRevocations = () => readCache<Revocations>(REV_CACHE)

/** Refresh the trust material in the background; returns true when both are fresh. */
export async function refreshTrustStore(): Promise<boolean> {
  const [key, rev] = await Promise.allSettled([api.publicKey(), api.revocations()])
  if (key.status === 'fulfilled') writeCache(KEY_CACHE, key.value)
  if (rev.status === 'fulfilled') writeCache(REV_CACHE, rev.value)
  return key.status === 'fulfilled' && rev.status === 'fulfilled'
}

/** Returns null when no public key is cached yet (first visit while offline). */
export async function verifyOnDevice(raw: string): Promise<LocalVerdict | null> {
  const key = cachedKey()
  const decoded = decodeToken(raw)
  const rev = cachedRevocations()
  const base = { checkedAt: Date.now(), revocationsAge: rev ? Date.now() - rev._fetchedAt : null }
  if (!decoded) return { result: 'malformed', claims: null, ...base }
  if (!key) return null
  let ok = false
  try {
    ok = await ed.verifyAsync(decoded.signature, decoded.payload, b64uToBytes(key.public_key))
  } catch {
    ok = false
  }
  if (!ok) return { result: 'tampered', claims: null, ...base }
  const { claims } = decoded
  let result: VerifyResult = 'valid'
  if (rev?.revoked.includes(claims.sid)) result = 'revoked'
  else if ((rev?.card_versions[claims.sid] ?? 1) > (claims.cv ?? 1)) result = 'superseded'
  else if (claims.exp < new Date().toISOString().slice(0, 10)) result = 'expired'
  return { result, claims, ...base }
}
