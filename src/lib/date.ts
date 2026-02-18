export function getDaysAged(dateAdded: string) {
  const added = new Date(`${dateAdded}T00:00:00`);
  const now = new Date();
  const diff = now.getTime() - added.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  return Math.max(0, days);
}
