/* BUILD-05 — Visual Engine
 *
 * Responsibilities:
 * - resolve verified official illustrations
 * - keep page-qualified visual IDs
 * - attach visuals to exact topics
 * - prevent unverified/unclear visuals from verified-question use
 * - provide visual study presentation models
 * - keep extracted source images separate from generated UI assets
 */
(function () {
  "use strict";

  const VISUAL_STATUS = Object.freeze({
    VERIFIED: "VERIFIED",
    VISUAL_PIXEL_PENDING: "VISUAL_PIXEL_PENDING",
    RELATIONSHIP_PENDING: "RELATIONSHIP_PENDING",
    NOT_APPLICABLE: "NOT_APPLICABLE",
    BLOCKED: "BLOCKED"
  });

  const RELATIONSHIP_STATUS = Object.freeze({
    VERIFIED: "VERIFIED",
    PENDING: "PENDING — VISUAL RELATIONSHIP VERIFICATION REQUIRED"
  });

  function normalizeVisual(record) {
    if (!record || typeof record !== "object") return null;

    return {
      visual_id: record.visual_id || null,
      source_id: record.source_id || null,
      track: record.track || null,
      physical_page: Number.isInteger(record.physical_page)
        ? record.physical_page
        : null,
      printed_page: Number.isInteger(record.printed_page)
        ? record.printed_page
        : null,
      figure: record.figure || null,
      topic_id: record.topic_id || null,
      subtopic_id: record.subtopic_id || null,
      asset_path: record.asset_path || null,
      source_asset: record.source_asset || null,
      display_context: record.display_context || "TOPIC",
      relationship_status:
        record.relationship_status || RELATIONSHIP_STATUS.PENDING,
      visual_status:
        record.visual_status || VISUAL_STATUS.VISUAL_PIXEL_PENDING,
      visual_question_eligible:
        record.visual_question_eligible === true
    };
  }

  class VisualStore {
    constructor(illustrationData, imageMapData, topicData, sourceData) {
      this.illustrations = (illustrationData?.illustrations || [])
        .map(normalizeVisual)
        .filter(Boolean);

      this.pending = illustrationData?.pending || [];

      this.visualIndex = new Map(
        this.illustrations.map(v => [v.visual_id, v])
      );

      this.topics = new Map(
        (topicData?.topics || []).map(t => [t.topic_id, t])
      );

      this.sources = new Map(
        (sourceData?.sources || []).map(s => [s.source_id, s])
      );

      this.maps = imageMapData?.maps || [];
    }

    get(visualId) {
      return this.visualIndex.get(visualId) || null;
    }

    all(options = {}) {
      let records = [...this.illustrations];

      if (options.source_id) {
        records = records.filter(v => v.source_id === options.source_id);
      }

      if (options.topic_id) {
        records = records.filter(v => v.topic_id === options.topic_id);
      }

      if (options.track) {
        records = records.filter(v => v.track === options.track);
      }

      if (options.visual_status) {
        records = records.filter(v => v.visual_status === options.visual_status);
      }

      if (options.relationship_status) {
        records = records.filter(
          v => v.relationship_status === options.relationship_status
        );
      }

      return records;
    }

    verified() {
      return this.all({
        visual_status: VISUAL_STATUS.VERIFIED,
        relationship_status: RELATIONSHIP_STATUS.VERIFIED
      });
    }

    forTopic(topicId, options = {}) {
      return this.all({ ...options, topic_id: topicId });
    }

    source(visualId) {
      const visual = this.get(visualId);
      return visual ? this.sources.get(visual.source_id) || null : null;
    }

    topic(visualId) {
      const visual = this.get(visualId);
      return visual ? this.topics.get(visual.topic_id) || null : null;
    }

    canUseInStudy(visualId) {
      const visual = this.get(visualId);
      if (!visual) return false;

      return (
        visual.visual_status === VISUAL_STATUS.VERIFIED &&
        visual.relationship_status === RELATIONSHIP_STATUS.VERIFIED &&
        Boolean(visual.source_id) &&
        Boolean(visual.topic_id)
      );
    }

    canUseInVisualQuestion(visualId) {
      const visual = this.get(visualId);
      if (!visual) return false;

      /*
       * A visual question is allowed only when both the source image
       * and its relationship to the exact topic are verified.
       */
      return (
        this.canUseInStudy(visualId) &&
        visual.visual_question_eligible === true
      );
    }

    presentationModel(visualId) {
      const visual = this.get(visualId);
      if (!visual) return null;

      const topic = this.topics.get(visual.topic_id) || null;
      const source = this.sources.get(visual.source_id) || null;

      return {
        visual_id: visual.visual_id,
        figure: visual.figure,
        source: {
          source_id: visual.source_id,
          title: source?.title || null,
          physical_page: visual.physical_page,
          printed_page: visual.printed_page
        },
        topic: {
          topic_id: visual.topic_id,
          title: topic?.title || null
        },
        asset: {
          path: visual.asset_path,
          source_asset: visual.source_asset
        },
        display_context: visual.display_context,
        relationship_status: visual.relationship_status,
        visual_status: visual.visual_status,
        visual_question_eligible: this.canUseInVisualQuestion(visualId)
      };
    }

    validate() {
      const errors = [];
      const warnings = [];
      const ids = new Set();

      for (const visual of this.illustrations) {
        if (!visual.visual_id) {
          errors.push("VIS-001: missing visual_id");
          continue;
        }

        if (ids.has(visual.visual_id)) {
          errors.push(`VIS-002: duplicate visual_id ${visual.visual_id}`);
        }
        ids.add(visual.visual_id);

        if (!visual.source_id || !this.sources.has(visual.source_id)) {
          errors.push(
            `VIS-003: ${visual.visual_id} references unknown source`
          );
        }

        if (!visual.topic_id || !this.topics.has(visual.topic_id)) {
          errors.push(
            `VIS-004: ${visual.visual_id} references unknown topic`
          );
        }

        if (
          visual.visual_status === VISUAL_STATUS.VERIFIED &&
          visual.relationship_status !== RELATIONSHIP_STATUS.VERIFIED
        ) {
          errors.push(
            `VIS-005: ${visual.visual_id} cannot be VERIFIED with pending relationship`
          );
        }

        if (
          visual.visual_question_eligible === true &&
          !this.canUseInStudy(visual.visual_id)
        ) {
          errors.push(
            `VIS-006: ${visual.visual_id} marked question-eligible without verified visual relationship`
          );
        }

        if (
          visual.visual_status === VISUAL_STATUS.VISUAL_PIXEL_PENDING
        ) {
          warnings.push(
            `VIS-W001: ${visual.visual_id} requires pixel-level verification`
          );
        }

        if (
          visual.relationship_status !== RELATIONSHIP_STATUS.VERIFIED
        ) {
          warnings.push(
            `VIS-W002: ${visual.visual_id} relationship is not verified`
          );
        }
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        counts: {
          total: this.illustrations.length,
          verified: this.verified().length,
          visual_question_eligible:
            this.illustrations.filter(v => v.visual_question_eligible).length
        }
      };
    }
  }

  /*
   * Produces a safe topic-level display model.
   * Unverified visuals are not returned as verified study visuals.
   */
  function buildTopicVisualModel(topicId, visualStore) {
    const topic = visualStore.topics.get(topicId);
    if (!topic) return null;

    const verified = visualStore
      .forTopic(topicId)
      .filter(v => visualStore.canUseInStudy(v.visual_id))
      .map(v => visualStore.presentationModel(v.visual_id));

    const pending = visualStore
      .forTopic(topicId)
      .filter(v => !visualStore.canUseInStudy(v.visual_id))
      .map(v => ({
        visual_id: v.visual_id,
        figure: v.figure,
        status: v.visual_status,
        relationship_status: v.relationship_status
      }));

    return {
      topic_id: topic.topic_id,
      topic_title: topic.title,
      verified_visuals: verified,
      pending_visuals: pending
    };
  }

  window.SSWVisual = {
    VISUAL_STATUS,
    RELATIONSHIP_STATUS,
    normalizeVisual,
    VisualStore,
    buildTopicVisualModel
  };
})();
