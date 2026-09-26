/* BUILD-03 — Source / Provenance Engine */
(function () {
  "use strict";

  const Provenance = {
    STATUS: Object.freeze({
      VERIFIED: "VERIFIED",
      PENDING_SOURCE_VERIFICATION: "PENDING_SOURCE_VERIFICATION",
      REVIEW_REQUIRED: "REVIEW_REQUIRED",
      BLOCKED: "BLOCKED"
    }),

    SOURCE_TYPES: Object.freeze({
      OFFICIAL_SOURCE: "OFFICIAL_SOURCE",
      OFFICIAL_SAMPLE: "OFFICIAL_SAMPLE",
      SOURCE_BASED_PRACTICE: "SOURCE_BASED_PRACTICE",
      PREDICTED_PRACTICE: "PREDICTED_PRACTICE"
    }),

    /**
     * A record may become VERIFIED only when:
     * - source_id exists
     * - physical_page is a positive integer
     * - source_id is registered
     * - track matches the registered source
     * - status is not pending/blocked
     */
    validate(record, sourcesIndex) {
      const errors = [];

      if (!record || typeof record !== "object") {
        return { valid: false, errors: ["PROV-001: record is not an object"] };
      }

      if (!record.source_id) {
        errors.push("PROV-002: missing source_id");
      }

      if (!Number.isInteger(record.physical_page) || record.physical_page < 1) {
        errors.push("PROV-003: physical_page must be a positive integer");
      }

      const source = record.source_id
        ? sourcesIndex.get(record.source_id)
        : null;

      if (!source) {
        errors.push("PROV-004: source_id is not registered");
      }

      if (source && record.track && source.track !== record.track) {
        errors.push("PROV-005: track/source mismatch");
      }

      if (
        record.status === this.STATUS.VERIFIED &&
        errors.length > 0
      ) {
        errors.push("PROV-006: invalid provenance cannot be VERIFIED");
      }

      if (
        record.status === this.STATUS.VERIFIED &&
        source &&
        source.status !== "VERIFIED"
      ) {
        errors.push("PROV-007: source itself is not VERIFIED");
      }

      return {
        valid: errors.length === 0,
        errors,
        source: source || null
      };
    },

    canPromote(record, sourcesIndex) {
      if (!record || record.status === this.STATUS.BLOCKED) return false;

      const result = this.validate(
        { ...record, status: this.STATUS.VERIFIED },
        sourcesIndex
      );

      return result.valid;
    },

    normalize(record) {
      return {
        ...record,
        source: {
          source_id: record.source_id ?? null,
          physical_page: record.physical_page ?? null,
          printed_page: record.printed_page ?? null,
          source_reference: record.source_reference ?? null
        }
      };
    }
  };

  class SourceRegistry {
    constructor(sourceData) {
      this.sources = Array.isArray(sourceData?.sources)
        ? sourceData.sources
        : [];

      this.index = new Map(
        this.sources.map(source => [source.source_id, source])
      );
    }

    get(sourceId) {
      return this.index.get(sourceId) || null;
    }

    has(sourceId) {
      return this.index.has(sourceId);
    }

    validateTrackIsolation(record) {
      const source = this.get(record.source_id);
      if (!source) return false;
      return !record.track || record.track === source.track;
    }
  }

  class ProvenanceEngine {
    constructor(sourceData) {
      this.registry = new SourceRegistry(sourceData);
    }

    validate(record) {
      return Provenance.validate(record, this.registry.index);
    }

    canPromote(record) {
      return Provenance.canPromote(record, this.registry.index);
    }

    normalize(record) {
      return Provenance.normalize(record);
    }

    source(sourceId) {
      return this.registry.get(sourceId);
    }

    trackIsolated(record) {
      return this.registry.validateTrackIsolation(record);
    }
  }

  window.SSWProvenance = {
    Provenance,
    SourceRegistry,
    ProvenanceEngine
  };
})();
