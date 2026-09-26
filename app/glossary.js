/* BUILD-06 — Glossary / Terminology Engine
 *
 * Source-controlled technical terminology layer.
 * Japanese terminology is never inferred by this engine.
 */
(function () {
  "use strict";

  const TERM_STATUS = Object.freeze({
    VERIFIED: "VERIFIED",
    PENDING: "PENDING",
    TERM_REVIEW: "TERM_REVIEW",
    SOURCE_REVIEW: "SOURCE_REVIEW",
    BLOCKED: "BLOCKED"
  });

  function normalizeTerm(record) {
    if (!record || typeof record !== "object") return null;

    return {
      term_id: record.term_id || null,
      source_id: record.source_id || null,
      track: record.track || null,
      source_page: Number.isInteger(record.source_page)
        ? record.source_page
        : null,
      physical_page: Number.isInteger(record.physical_page)
        ? record.physical_page
        : null,
      printed_page: Number.isInteger(record.printed_page)
        ? record.printed_page
        : null,

      japanese: record.japanese || "",
      furigana: record.furigana || "",
      english: record.english || "",
      sinhala: record.sinhala || "",

      aliases: Array.isArray(record.aliases)
        ? [...record.aliases]
        : [],

      abbreviation: record.abbreviation || null,
      category: record.category || "GENERAL",
      context: record.context || null,

      status: record.status || TERM_STATUS.PENDING,
      source_reference: record.source_reference || null
    };
  }

  function validateTerm(record, sourceIndex) {
    const errors = [];
    const warnings = [];

    if (!record || typeof record !== "object") {
      return {
        valid: false,
        errors: ["TERM-001: invalid terminology record"],
        warnings
      };
    }

    if (!record.term_id) errors.push("TERM-002: missing term_id");
    if (!record.source_id) errors.push("TERM-003: missing source_id");
    if (!record.japanese) errors.push("TERM-004: missing Japanese source term");
    if (!record.english) errors.push("TERM-005: missing English meaning");

    const source = sourceIndex?.get(record.source_id);

    if (!source) {
      errors.push("TERM-006: source_id is not registered");
    }

    if (source && record.track && source.track !== record.track) {
      errors.push("TERM-007: track/source mismatch");
    }

    if (record.status === TERM_STATUS.VERIFIED) {
      if (!record.japanese) {
        errors.push("TERM-008: VERIFIED term requires Japanese source terminology");
      }

      if (!record.english) {
        errors.push("TERM-009: VERIFIED term requires English meaning");
      }

      if (!record.sinhala) {
        errors.push("TRI-001: VERIFIED substantive term requires Sinhala explanation");
      }

      if (!Number.isInteger(record.physical_page) || record.physical_page < 1) {
        errors.push("TERM-010: VERIFIED term requires physical_page");
      }

      if (!source || source.status !== "VERIFIED") {
        errors.push("TERM-011: VERIFIED term requires VERIFIED source");
      }
    }

    if (
      record.status === TERM_STATUS.VERIFIED &&
      record.japanese.includes("PENDING")
    ) {
      errors.push("TERM-012: pending Japanese marker cannot be VERIFIED");
    }

    if (record.status === TERM_STATUS.PENDING) {
      warnings.push(
        "TERM-W001: term remains pending and must not be presented as verified official terminology."
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      source: source || null
    };
  }

  class GlossaryStore {
    constructor(glossaryData, sourceData) {
      this.terms = (glossaryData?.terms || [])
        .map(normalizeTerm)
        .filter(Boolean);

      this.sources = new Map(
        (sourceData?.sources || []).map(source => [
          source.source_id,
          source
        ])
      );

      this.index = new Map(
        this.terms.map(term => [term.term_id, term])
      );
    }

    get(termId) {
      return this.index.get(termId) || null;
    }

    all(options = {}) {
      let terms = [...this.terms];

      if (options.track) {
        terms = terms.filter(term => term.track === options.track);
      }

      if (options.status) {
        terms = terms.filter(term => term.status === options.status);
      }

      if (options.category) {
        terms = terms.filter(term => term.category === options.category);
      }

      return terms;
    }

    verified(options = {}) {
      return this.all({
        ...options,
        status: TERM_STATUS.VERIFIED
      });
    }

    search(query, options = {}) {
      const q = String(query || "").trim().toLowerCase();

      if (!q) return this.all(options);

      return this.all(options).filter(term => {
        const haystack = [
          term.japanese,
          term.furigana,
          term.english,
          term.sinhala,
          term.abbreviation || "",
          term.category,
          term.context || "",
          ...(term.aliases || [])
        ]
          .join(" ")
          .toLowerCase();

        return haystack.includes(q);
      });
    }

    source(termId) {
      const term = this.get(termId);
      return term ? this.sources.get(term.source_id) || null : null;
    }

    validate() {
      const errors = [];
      const warnings = [];
      const ids = new Set();

      for (const term of this.terms) {
        if (ids.has(term.term_id)) {
          errors.push(`TERM-013: duplicate term_id ${term.term_id}`);
        }
        ids.add(term.term_id);

        const result = validateTerm(term, this.sources);

        if (!result.valid) {
          errors.push({
            term_id: term.term_id,
            errors: result.errors
          });
        }

        for (const warning of result.warnings) {
          warnings.push({
            term_id: term.term_id,
            warning
          });
        }
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        counts: {
          total: this.terms.length,
          verified: this.verified().length,
          pending: this.all({ status: TERM_STATUS.PENDING }).length
        }
      };
    }
  }

  /*
   * UI-safe terminology model.
   * The engine intentionally does not add language names/flags.
   */
  function buildTermPresentation(term) {
    if (!term) return null;

    return {
      term_id: term.term_id,
      primary: {
        japanese: term.japanese,
        furigana: term.furigana
      },
      meaning: {
        english: term.english,
        sinhala: term.sinhala
      },
      abbreviation: term.abbreviation,
      category: term.category,
      context: term.context,
      aliases: term.aliases,
      source: {
        source_id: term.source_id,
        physical_page: term.physical_page,
        printed_page: term.printed_page,
        source_reference: term.source_reference
      },
      status: term.status
    };
  }

  /*
   * Returns only terminology that is safe for VERIFIED study/exam display.
   */
  function buildVerifiedTermMap(termIds, glossaryStore) {
    if (!Array.isArray(termIds)) return [];

    return termIds
      .map(id => glossaryStore.get(id))
      .filter(term => term && term.status === TERM_STATUS.VERIFIED)
      .map(buildTermPresentation);
  }

  window.SSWGlossary = {
    TERM_STATUS,
    normalizeTerm,
    validateTerm,
    GlossaryStore,
    buildTermPresentation,
    buildVerifiedTermMap
  };
})();
