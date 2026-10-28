/**
 * Play Integrity attestation: asks Google Play to vouch that this is the
 * genuine, Play-installed, unmodified app, and lets the backend verify it.
 */
import { Platform } from "react-native";
import PlayIntegrity from "@/modules/expo-play-integrity";
import { api } from "@/src/api/client";

let preparedFor: string | null = null;
let inflight: Promise<boolean> | null = null;

type Listener = () => void;
const listeners = new Set<Listener>();
let failed = false;

export function isIntegrityFailed() {
  return failed;
}
export function onIntegrityFailed(cb: Listener) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
export function markIntegrityFailed() {
  if (failed) return;
  failed = true;
  listeners.forEach((l) => l());
}

/** Returns true when verified (or when protection is not enabled server-side). */
export function attestIntegrity(): Promise<boolean> {
  if (Platform.OS !== "android" || !PlayIntegrity) return Promise.resolve(true);
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const cfg = await api<{ enabled: boolean; project_number?: string; nonce?: string }>("/integrity/config");
      if (!cfg.enabled || !cfg.project_number || !cfg.nonce) return true;
      if (preparedFor !== cfg.project_number) {
        await PlayIntegrity.prepare(Number(cfg.project_number));
        preparedFor = cfg.project_number;
      }
      let token: string;
      try {
        token = await PlayIntegrity.requestToken(cfg.nonce);
      } catch {
        preparedFor = null;
        await PlayIntegrity.prepare(Number(cfg.project_number));
        preparedFor = cfg.project_number;
        token = await PlayIntegrity.requestToken(cfg.nonce);
      }
      const r = await api<{ ok: boolean }>("/integrity/verify", { method: "POST", body: { token, nonce: cfg.nonce } });
      if (!r.ok) markIntegrityFailed();
      return r.ok;
    } catch (e) {
      // Network / Play services hiccup: don't block; server will ask again.
      console.warn("[Integrity] attest error", e);
      return false;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}
