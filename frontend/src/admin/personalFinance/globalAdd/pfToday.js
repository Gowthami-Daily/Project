export function todayISODate() {
  return new Date().toISOString().slice(0, 10)
}
