/** Persistent VPS/Docker host: data stays on the server disk, not on a workshop PC. */
export function isPersistentServer() {
  return process.env.HOSTING === "vps" || process.env.PERSISTENT_DISK === "1";
}
