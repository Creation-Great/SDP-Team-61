type CategoryKey =
  | 'technical_contributions'
  | 'team_interactions'
  | 'project_management'
  | 'team_chemistry';

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
}

export interface CategoryAggregate {
  key: CategoryKey;
  label: string;
  average: number | null;
  count: number;
}

export interface StudentAggregate {
  team: string;
  student_name: string;
  per_category: Record<CategoryKey, { average: number | null; count: number }>;
  overall_average: number | null;
  comments: string[];
}

export interface AggregateResult {
  summary: {
    files_received: number;
    files_processed: number;
    evaluations_count: number;
    skipped_rows: number;
  };
  categories: CategoryAggregate[];
  students: StudentAggregate[];
  file_reports: Array<{
    file_name: string;
    rows_processed: number;
    rows_skipped: number;
    detected_columns: Partial<Record<CategoryKey | 'student_name', string>>;
  }>;
}

const CATEGORY_CONFIG: Array<{ key: CategoryKey; label: string; patterns: string[] }> = [
  {
    key: 'technical_contributions',
    label: 'Technical Contributions',
    patterns: ['technical contribution', 'technical contributions', 'technical'],
  },
  {
    key: 'team_interactions',
    label: 'Team Interactions',
    patterns: ['team interaction', 'team interactions', 'interaction'],
  },
  {
    key: 'project_management',
    label: 'Project Management',
    patterns: ['project management', 'management'],
  },
  {
    key: 'team_chemistry',
    label: 'Team Chemistry',
    patterns: ['team chemistry', 'chemistry', 'i like the team'],
  },
];

const NAME_PATTERNS = ['name', 'student', 'member'];
const TEAM_PATTERNS = ['team', 'group'];
const COMMENT_PATTERNS = ['individual comments', 'comments', 'comment'];

function normalizeHeader(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, ' ');
}

function parseLine(line: string): string[] {
  const fields: string[] = [];
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
      fields.push(current.trim());
      current = '';
      continue;
    }

    current += ch;
  }

  fields.push(current.trim());
  return fields;
}

export function parseCsv(csvText: string): ParsedCsv {
  const clean = csvText.replace(/^\uFEFF/, '');
  const lines = clean
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine);
  return { headers, rows };
}

function findColumn(headers: string[], patterns: string[]): number {
  const normalized = headers.map(normalizeHeader);

  for (let i = 0; i < normalized.length; i += 1) {
    const h = normalized[i];
    if (patterns.some((p) => h.includes(p))) {
      return i;
    }
  }

  return -1;
}

function parseScore(raw: string | undefined): number | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const value = Number(trimmed);
  if (Number.isNaN(value) || value < 1 || value > 5) {
    return null;
  }

  return value;
}

export function aggregatePeerReviewCsvFiles(files: Express.Multer.File[]): AggregateResult {
  const categoryTotals: Record<CategoryKey, { sum: number; count: number }> = {
    technical_contributions: { sum: 0, count: 0 },
    team_interactions: { sum: 0, count: 0 },
    project_management: { sum: 0, count: 0 },
    team_chemistry: { sum: 0, count: 0 },
  };

  const studentTotals = new Map<
    string,
    {
      team: string;
      studentName: string;
      totals: Record<CategoryKey, { sum: number; count: number }>;
      comments: string[];
    }
  >();

  const fileReports: AggregateResult['file_reports'] = [];
  let filesProcessed = 0;
  let evaluationsCount = 0;
  let skippedRows = 0;

  files.forEach((file) => {
    const parsed = parseCsv(file.buffer.toString('utf-8'));
    if (parsed.headers.length === 0) {
      fileReports.push({
        file_name: file.originalname,
        rows_processed: 0,
        rows_skipped: 0,
        detected_columns: {},
      });
      return;
    }

    const teamIndex = findColumn(parsed.headers, TEAM_PATTERNS);
    const nameIndex = findColumn(parsed.headers, NAME_PATTERNS);
    const commentIndex = findColumn(parsed.headers, COMMENT_PATTERNS);
    const categoryIndexes = CATEGORY_CONFIG.map((cfg) => ({
      ...cfg,
      index: findColumn(parsed.headers, cfg.patterns),
    }));

    if (nameIndex === -1) {
      fileReports.push({
        file_name: file.originalname,
        rows_processed: 0,
        rows_skipped: parsed.rows.length,
        detected_columns: {},
      });
      skippedRows += parsed.rows.length;
      return;
    }

    filesProcessed += 1;

    let rowsProcessed = 0;
    let rowsSkipped = 0;
    const detectedColumns: AggregateResult['file_reports'][number]['detected_columns'] = {
      student_name: parsed.headers[nameIndex],
    };

    categoryIndexes.forEach((cat) => {
      if (cat.index !== -1) {
        detectedColumns[cat.key] = parsed.headers[cat.index];
      }
    });

    parsed.rows.forEach((row) => {
      const team = teamIndex === -1 ? '' : (row[teamIndex] || '').trim();
      const studentName = (row[nameIndex] || '').trim();
      if (!studentName) {
        rowsSkipped += 1;
        return;
      }

      let scoredAnyCategory = false;
      const studentKey = `${team.toLowerCase()}::${studentName.toLowerCase()}`;
      if (!studentTotals.has(studentKey)) {
        studentTotals.set(studentKey, {
          team,
          studentName,
          totals: {
            technical_contributions: { sum: 0, count: 0 },
            team_interactions: { sum: 0, count: 0 },
            project_management: { sum: 0, count: 0 },
            team_chemistry: { sum: 0, count: 0 },
          },
          comments: [],
        });
      }

      const studentEntry = studentTotals.get(studentKey)!;

      // Collect individual comment
      if (commentIndex !== -1) {
        const comment = (row[commentIndex] || '').trim();
        if (comment) studentEntry.comments.push(comment);
      }

      categoryIndexes.forEach((cat) => {
        if (cat.index === -1) return;
        const score = parseScore(row[cat.index]);
        if (score === null) return;

        scoredAnyCategory = true;
        categoryTotals[cat.key].sum += score;
        categoryTotals[cat.key].count += 1;
        studentEntry.totals[cat.key].sum += score;
        studentEntry.totals[cat.key].count += 1;
      });

      if (!scoredAnyCategory) {
        rowsSkipped += 1;
        return;
      }

      rowsProcessed += 1;
      evaluationsCount += 1;
    });

    skippedRows += rowsSkipped;
    fileReports.push({
      file_name: file.originalname,
      rows_processed: rowsProcessed,
      rows_skipped: rowsSkipped,
      detected_columns: detectedColumns,
    });
  });

  const categories: CategoryAggregate[] = CATEGORY_CONFIG.map((cfg) => {
    const totals = categoryTotals[cfg.key];
    return {
      key: cfg.key,
      label: cfg.label,
      average: totals.count > 0 ? Number((totals.sum / totals.count).toFixed(2)) : null,
      count: totals.count,
    };
  });

  const students: StudentAggregate[] = Array.from(studentTotals.values())
    .map((totals_entry) => {
      const { team, studentName, totals } = totals_entry;
      let allSum = 0;
      let allCount = 0;

      const perCategory = {
        technical_contributions: {
          average:
            totals.technical_contributions.count > 0
              ? Number(
                  (totals.technical_contributions.sum / totals.technical_contributions.count).toFixed(2)
                )
              : null,
          count: totals.technical_contributions.count,
        },
        team_interactions: {
          average:
            totals.team_interactions.count > 0
              ? Number((totals.team_interactions.sum / totals.team_interactions.count).toFixed(2))
              : null,
          count: totals.team_interactions.count,
        },
        project_management: {
          average:
            totals.project_management.count > 0
              ? Number((totals.project_management.sum / totals.project_management.count).toFixed(2))
              : null,
          count: totals.project_management.count,
        },
        team_chemistry: {
          average:
            totals.team_chemistry.count > 0
              ? Number((totals.team_chemistry.sum / totals.team_chemistry.count).toFixed(2))
              : null,
          count: totals.team_chemistry.count,
        },
      } as StudentAggregate['per_category'];

      Object.values(totals).forEach((entry) => {
        allSum += entry.sum;
        allCount += entry.count;
      });

      return {
        team,
        student_name: studentName,
        per_category: perCategory,
        overall_average: allCount > 0 ? Number((allSum / allCount).toFixed(2)) : null,
        comments: totals_entry.comments,
      };
    })
    .sort((a, b) => {
      const teamCmp = (a.team || '').localeCompare(b.team || '');
      if (teamCmp !== 0) return teamCmp;
      return a.student_name.localeCompare(b.student_name);
    });

  return {
    summary: {
      files_received: files.length,
      files_processed: filesProcessed,
      evaluations_count: evaluationsCount,
      skipped_rows: skippedRows,
    },
    categories,
    students,
    file_reports: fileReports,
  };
}
