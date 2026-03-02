const RESERVED = new Set(['team', 'name', 'self', 'individual comments']);

export interface ParsedDefinition {
  teams: { key: string; students: ParsedStudent[] }[];
  categories: string[];
}

export interface ParsedStudent {
  team_key: string;
  full_name: string;
  first_name: string;
  last_name: string;
  netid_guess: string;
}

/**
 * Compute a 3-char netid prefix from first name and last name.
 * Pattern: first2charsOfFirstName + first1charOfLastName, lowercase, only a-z, padded to 3 with 'x'.
 * Example: "Alice Wang" -> "alw", "Bob Johnson" -> "boj"
 */
export function computeNetidGuess(firstName: string, lastName: string): string {
  const clean = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');
  const f = clean(firstName);
  const l = clean(lastName);
  const part = (f.slice(0, 2) + l.slice(0, 1)).padEnd(3, 'x');
  return part.slice(0, 3);
}

/**
 * Parse a CSV buffer into a ParsedDefinition.
 * - Strips BOM, splits lines, skips blank lines
 * - Finds "Team" and "Name" column indices (case-insensitive), throws if missing
 * - All other non-reserved columns become category labels
 * - Groups students by team_key
 */
export function parseCsv(buffer: Buffer): ParsedDefinition {
  let text = buffer.toString('utf8');
  // Strip BOM
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }

  const lines = text.split(/\r?\n/);
  const nonBlank = lines.filter(l => l.trim().length > 0);
  if (nonBlank.length === 0) {
    throw new Error('CSV is empty');
  }

  // Parse header row
  const header = nonBlank[0].split(',').map(h => h.trim());

  const teamIdx = header.findIndex(h => h.toLowerCase() === 'team');
  const nameIdx = header.findIndex(h => h.toLowerCase() === 'name');

  if (teamIdx === -1) throw new Error('CSV must have a "Team" column');
  if (nameIdx === -1) throw new Error('CSV must have a "Name" column');

  // Category columns: non-reserved, not team/name
  const categories: string[] = [];
  for (let i = 0; i < header.length; i++) {
    if (i === teamIdx || i === nameIdx) continue;
    if (RESERVED.has(header[i].toLowerCase())) continue;
    if (header[i].length === 0) continue;
    categories.push(header[i]);
  }

  // Parse data rows
  const teamMap = new Map<string, ParsedStudent[]>();

  for (let r = 1; r < nonBlank.length; r++) {
    const cols = nonBlank[r].split(',').map(c => c.trim());
    const teamKey = (cols[teamIdx] || '').trim();
    const fullName = (cols[nameIdx] || '').trim();

    if (!teamKey || !fullName) continue;

    const parts = fullName.trim().split(/\s+/);
    const firstName = parts[0] || '';
    const lastName = parts.slice(1).join(' ') || '';
    const netid_guess = computeNetidGuess(firstName, lastName);

    const student: ParsedStudent = {
      team_key: teamKey,
      full_name: fullName,
      first_name: firstName,
      last_name: lastName,
      netid_guess,
    };

    if (!teamMap.has(teamKey)) {
      teamMap.set(teamKey, []);
    }
    teamMap.get(teamKey)!.push(student);
  }

  const teams = Array.from(teamMap.entries()).map(([key, students]) => ({ key, students }));

  return { teams, categories };
}
