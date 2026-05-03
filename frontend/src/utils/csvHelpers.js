/** Pure helpers for CSV parsing and score utilities (no React). */

export const RESERVED_HEADERS = new Set(['team', 'name', 'self', 'individual comments']);

export function parseCsvLine(line) {
  const out = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      out.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  out.push(current.trim());
  return out;
}

export function parseCsv(text) {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  return {
    headers: parseCsvLine(lines[0]),
    rows: lines.slice(1).map(parseCsvLine),
  };
}

export function toScore(value) {
  const n = Number(value);
  if (Number.isNaN(n) || n < 1 || n > 5) return null;
  return n;
}

export function csvEscape(value) {
  const str = String(value ?? '');
  if (!str.includes(',') && !str.includes('"') && !str.includes('\n')) return str;
  return `"${str.replace(/"/g, '""')}"`;
}

export function buildDefaultWeek(id, label, members, topics) {
  const scores = {};
  const comments = {};
  members.forEach((m) => {
    scores[m.id] = {};
    comments[m.id] = '';
    topics.forEach((t) => {
      scores[m.id][t] = '';
    });
  });
  return { id, label, scores, comments, additional_comments: '' };
}
