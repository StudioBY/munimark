// ── Where a displayed asset came from, and under what licence ────────────────
//
// Reads `asset_provenance` (migration 011) rather than the columns that used to
// live on `mayors`. A photo's licence is a property of the FILE; keeping it on
// the person's row meant every new source added three more columns to a table
// that is supposed to describe a human being.
//
// The old columns are still present and still populated. They are deprecated,
// not dropped: they hold attributions we are obliged to display, and losing
// them to a migration bug is not a recoverable mistake. This module reads the
// new table and FALLS BACK to the old columns, so the page is correct whether
// or not migration 011 has run yet. The fallback goes away when the columns do.

export interface Provenance {
  source: string | null
  license: string | null
  license_url: string | null
  attribution: string | null
  source_page: string | null
}

export interface ProvenanceRow extends Provenance {
  entity_type: string
  entity_id: number
  field: string
}

/** Legacy shape: the provenance columns as they still exist on `mayors`. */
export interface LegacyProvenanceCarrier {
  id: number
  photo_source?: string | null
  photo_license?: string | null
  photo_license_url?: string | null
  photo_artist?: string | null
  photo_file_page?: string | null
  background_source?: string | null
  background_source_url?: string | null
  background_license?: string | null
}

const EMPTY: Provenance = {
  source: null, license: null, license_url: null, attribution: null, source_page: null,
}

function fromLegacy(row: LegacyProvenanceCarrier, field: string): Provenance {
  if (field === 'photo_url') {
    return {
      source: row.photo_source ?? null,
      license: row.photo_license ?? null,
      license_url: row.photo_license_url ?? null,
      attribution: row.photo_artist ?? null,
      source_page: row.photo_file_page ?? null,
    }
  }
  if (field === 'background') {
    return {
      source: row.background_source ?? null,
      license: row.background_license ?? null,
      license_url: null,
      attribution: null,
      source_page: row.background_source_url ?? null,
    }
  }
  return EMPTY
}

/**
 * Index provenance rows for lookup by (entity_id, field).
 * `rows` may be null when the table does not exist yet — the caller then gets
 * the legacy values instead, which is why nothing here throws.
 */
export function indexProvenance(rows: ProvenanceRow[] | null | undefined) {
  const map = new Map<string, Provenance>()
  for (const r of rows ?? []) map.set(`${r.entity_type}|${r.entity_id}|${r.field}`, r)
  return {
    /** Provenance for one field, preferring the table and falling back to the row. */
    get(entityType: string, row: LegacyProvenanceCarrier, field: string): Provenance {
      const hit = map.get(`${entityType}|${row.id}|${field}`)
      if (hit && (hit.license || hit.attribution || hit.source)) return hit
      return fromLegacy(row, field)
    },
    size: map.size,
  }
}

/** A licence we may display: free ones only. Absence of a licence is not one. */
export function isFreeLicense(license: string | null): boolean {
  if (!license) return false
  return /^(CC0|CC BY(-SA)?( \d)?|Public domain|PD([- ]|$)|GFDL|Attribution)/i.test(license)
}
