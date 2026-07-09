//
// scripts/extract-connectors.mjs
//
// Regenerates data/connectors.json (the Sentinel table -> connector/solution
// mapping used for requiredDataConnectors validation and auto-population) from
// Microsoft's official Solutions Analyzer CSVs in the Azure-Sentinel repository.
//
// This replaces the legacy per-connector-JSON PowerShell extractor, which could
// not resolve the tables for modern CCP/CCF connectors (they expose their table
// only via templated "{{graphQueriesTableName}}" placeholders). The Solutions
// Analyzer CSVs are Microsoft-maintained and carry real, clean table names for
// every solution.
//
// Table names per connector are derived from:
//   1. connectors.csv `event_vendor_product_by_table` (precise, when present), or
//   2. a `solution_name` join into content_tables_mapping.csv (coverage fallback).
//
// The RFC 4180 CSV parser is ported from the SentinelForge catalog-sync pipeline.
//
// Created by Toby G on 09/07/2026.
//

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const GITHUB_RAW_BASE =
  'https://raw.githubusercontent.com/Azure/Azure-Sentinel/master/Tools/Solutions%20Analyzer';

const OUTPUT_FILE = fileURLToPath(new URL('../data/connectors.json', import.meta.url));

// ---------------------------------------------------------------------------
// Authoritative table overrides. Some connectors ship no
// `event_vendor_product_by_table` mapping (empty cell), so they fall back to the
// union of every table used anywhere in their solution. For multi-content
// solutions that over-attributes tables the connector does not ingest (e.g. the
// "Microsoft 365" solution's rules query SigninLogs/Operation, which are not
// Office 365 tables). Entries here replace the derived list entirely and are
// keyed by connector_id. Keep this list small and authoritative.
// ---------------------------------------------------------------------------

const CONNECTOR_TABLE_OVERRIDES = {
  // The Office 365 connector streams only the unified OfficeActivity table.
  Office365: ['OfficeActivity'],
};

// ---------------------------------------------------------------------------
// RFC 4180 CSV parser (dependency-free). Handles quoted fields with embedded
// commas, newlines, and doubled ("") escaped quotes.
// ---------------------------------------------------------------------------

function parseRows(text) {
  const rows = [];
  let current = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        field += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === ',') {
        current.push(field);
        field = '';
        i++;
      } else if (ch === '\r' || ch === '\n') {
        current.push(field);
        field = '';
        rows.push(current);
        current = [];
        if (ch === '\r' && i + 1 < text.length && text[i + 1] === '\n') {
          i += 2;
        } else {
          i++;
        }
      } else {
        field += ch;
        i++;
      }
    }
  }

  if (field !== '' || current.length > 0) {
    current.push(field);
    rows.push(current);
  }

  return rows;
}

function parseCSV(text) {
  const rows = parseRows(text);
  if (rows.length < 2) {
    return [];
  }

  const headers = rows[0];
  const results = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length === 1 && row[0] === '') {
      continue;
    }

    const record = {};
    for (let j = 0; j < headers.length; j++) {
      record[headers[j]] = j < row.length ? row[j] : '';
    }
    results.push(record);
  }

  return results;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchCSV(filename) {
  const url = `${GITHUB_RAW_BASE}/${filename}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${filename}: ${res.status} ${res.statusText}`);
  }
  return parseCSV(await res.text());
}

// Strip parenthetical solution labels (e.g. "CommonSecurityLog (Darktrace)") and
// trim; real Log Analytics table names never contain parentheses.
function cleanTable(name) {
  if (!name) {
    return '';
  }
  return String(name)
    .replace(/\s*\([^)]*\)/g, '')
    .trim();
}

function isTruthyFlag(value) {
  const v = (value || '').toString().trim().toLowerCase();
  return v === 'true' || v === 'yes' || v === '1';
}

// Conform a connector id to the CONNECTOR_ID validation pattern
// (^[A-Za-z0-9][A-Za-z0-9_.-]*$). Upstream ids occasionally contain characters
// that never appear in a rule's requiredDataConnectors (e.g. the "/" in
// "GCPPub/SubAuditLogs"); strip anything outside the allowed set.
function sanitizeConnectorId(id) {
  return (id || '')
    .replace(/[^A-Za-z0-9_.-]/g, '')
    .replace(/^[_.-]+/, '');
}

// Read the previously generated connectors.json (if any) so connectors the CSVs
// cannot resolve can be enriched from known-good data. Connector-only solutions
// (e.g. Barracuda WAF, Cisco UCS) feed CommonSecurityLog/Syslog but ship no
// analytic rules, so content_tables_mapping.csv has nothing to join against.
function readExistingConnectors() {
  const map = new Map();
  try {
    const data = JSON.parse(readFileSync(OUTPUT_FILE, 'utf8'));
    for (const c of data.tablesByConnector || []) {
      const id = sanitizeConnectorId(c.connectorId);
      if (!id) {
        continue;
      }
      const list = [
        ...new Set(
          (Array.isArray(c.tables) ? c.tables : [c.tables])
            .map(cleanTable)
            .filter((t) => t && !/\{\{/.test(t)),
        ),
      ];
      map.set(id, {
        connectorId: id,
        connectorTitle: c.connectorTitle,
        descriptionMarkdown: c.descriptionMarkdown || '',
        publisher: c.publisher || '',
        source: c.source || 'DataConnectors',
        tables: list,
      });
    }
  } catch {
    // No existing file (first run) - nothing to enrich from.
  }
  return map;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const fallback = readExistingConnectors();
  console.log('Fetching Solutions Analyzer CSVs from Azure-Sentinel...');
  const [connectors, contentTables] = await Promise.all([
    fetchCSV('connectors.csv'),
    fetchCSV('content_tables_mapping.csv'),
  ]);
  console.log(
    `  connectors.csv: ${connectors.length} rows, content_tables_mapping.csv: ${contentTables.length} rows`,
  );

  // solution_name -> Set(table names) from every content item's table usage.
  const solutionTables = new Map();
  for (const row of contentTables) {
    const solution = (row.solution_name || '').trim();
    const table = cleanTable(row.table_name);
    if (!solution || !table) {
      continue;
    }
    if (!solutionTables.has(solution)) {
      solutionTables.set(solution, new Set());
    }
    solutionTables.get(solution).add(table);
  }

  // Build a de-duplicated connector map (a connector_id can recur across rows).
  const byId = new Map();

  for (const row of connectors) {
    const id = sanitizeConnectorId((row.connector_id || '').trim());
    if (!id) {
      continue;
    }
    const solution = (row.solution_name || '').trim();

    // Precise per-connector tables from event_vendor_product_by_table, else the
    // solution-level table set from content_tables_mapping.
    const tables = new Set();
    const evpbt = (row.event_vendor_product_by_table || '').trim();
    if (evpbt) {
      try {
        const parsed = JSON.parse(evpbt);
        for (const key of Object.keys(parsed)) {
          const table = cleanTable(key);
          if (table) {
            tables.add(table);
          }
        }
      } catch {
        // Malformed JSON in the source cell - ignore and fall through.
      }
    }
    if (tables.size === 0 && solution && solutionTables.has(solution)) {
      for (const table of solutionTables.get(solution)) {
        tables.add(table);
      }
    }

    const deprecated = isTruthyFlag(row.is_deprecated);
    let title = (row.connector_title || id).trim();
    if (deprecated && !/deprecated/i.test(title)) {
      title = `${title} [Deprecated]`;
    }

    let entry = byId.get(id);
    if (!entry) {
      entry = {
        connectorId: id,
        connectorTitle: title,
        descriptionMarkdown: (row.connector_description || '').trim(),
        publisher: (row.connector_publisher || '').trim(),
        source: solution ? `Solutions/${solution}` : 'DataConnectors',
        tables: new Set(),
      };
      byId.set(id, entry);
    }
    for (const table of tables) {
      entry.tables.add(table);
    }
    if (deprecated && !/deprecated/i.test(entry.connectorTitle)) {
      entry.connectorTitle = title;
    }
  }

  // Enrich from previously-known data: fill connectors the CSVs left table-less,
  // and preserve connectors-with-tables that are absent from the CSV set. CSV
  // data always takes precedence - only empty table lists are filled.
  let filled = 0;
  let preserved = 0;
  for (const [id, prev] of fallback) {
    if (prev.tables.length === 0) {
      continue;
    }
    const entry = byId.get(id);
    if (entry) {
      if (entry.tables.size === 0) {
        for (const table of prev.tables) {
          entry.tables.add(table);
        }
        filled++;
      }
    } else {
      byId.set(id, {
        connectorId: prev.connectorId,
        connectorTitle: prev.connectorTitle,
        descriptionMarkdown: prev.descriptionMarkdown,
        publisher: prev.publisher,
        source: prev.source,
        tables: new Set(prev.tables),
      });
      preserved++;
    }
  }
  console.log(`  Enriched from existing data: filled ${filled}, preserved ${preserved}`);

  // Finalise: sort tables, collapse single-table lists to a string (matching the
  // existing connectors.json shape consumed by ConnectorLoader), collect counts.
  const allTables = new Set();
  const tablesByConnector = [...byId.values()]
    .map((entry) => {
      const override = CONNECTOR_TABLE_OVERRIDES[entry.connectorId];
      const derived = override ? override : [...entry.tables];
      const list = [...new Set(derived.map(cleanTable).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b),
      );
      for (const table of list) {
        allTables.add(table);
      }
      return {
        connectorId: entry.connectorId,
        connectorTitle: entry.connectorTitle,
        descriptionMarkdown: entry.descriptionMarkdown,
        publisher: entry.publisher,
        source: entry.source,
        tables: list.length === 1 ? list[0] : list,
      };
    })
    .sort((a, b) => a.connectorTitle.localeCompare(b.connectorTitle));

  const output = {
    metadata: {
      generatedDate: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
      totalConnectors: tablesByConnector.length,
      totalTables: allTables.size,
      sourceRepository: 'https://github.com/Azure/Azure-Sentinel',
      extractionVersion: '2.0.0',
      extractionMethod: 'Solutions Analyzer CSV',
    },
    tablesByConnector,
  };

  writeFileSync(OUTPUT_FILE, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

  const withTables = tablesByConnector.filter((c) =>
    Array.isArray(c.tables) ? c.tables.length > 0 : Boolean(c.tables),
  ).length;
  console.log('Extraction complete.');
  console.log(`  Connectors: ${tablesByConnector.length} (${withTables} with tables)`);
  console.log(`  Unique tables: ${allTables.size}`);
  console.log(`  Written to: ${OUTPUT_FILE}`);
}

main().catch((err) => {
  console.error(`Extraction failed: ${err.message}`);
  process.exit(1);
});
