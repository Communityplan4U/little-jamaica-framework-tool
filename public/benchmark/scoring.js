(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BenchmarkScoring = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const sum = values => values.reduce((total, value) => total + value, 0);
  const nearZero = value => Math.abs(value) < 1e-12 ? 0 : value;
  const categoryOf = criterion => criterion.categoryId || criterion.area;

  function normalize(weights, label) {
    for (const value of Object.values(weights)) {
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        throw new Error(`${label} must be finite, non-negative numbers.`);
      }
    }
    const total = sum(Object.values(weights));
    if (!(total > 0)) throw new Error(`${label} must include at least one positive weight.`);
    return Object.fromEntries(Object.entries(weights).map(([id, value]) => [id, value / total]));
  }

  function customAllocation(items, customWeights) {
    if (!customWeights || typeof customWeights !== 'object' || Array.isArray(customWeights)) {
      throw new Error('Custom weights must be provided as an object.');
    }
    const ids = new Set(items.map(item => item.id));
    for (const id of Object.keys(customWeights)) {
      if (!ids.has(id)) throw new Error(`Unknown custom weight: ${id}.`);
    }
    const allocation = Object.fromEntries(items.map(item => [item.id, customWeights[item.id] ?? 0]));
    return normalize(allocation, 'Custom weights');
  }

  /**
   * Calculate documentary comparison scores without changing source data.
   * Framework: topic weight / linked criteria, then weighted rating difference.
   * TOR: governance-area weight / area criteria, then 12 × weighted signed rating.
   * A selected area is normalized to 100% of the displayed comparison.
   * Category values are contributions and therefore sum to each study's value.
   */
  function calculate(dataset, options = {}) {
    if (!dataset || !Array.isArray(dataset.criteria) || !dataset.criteria.length ||
        !Array.isArray(dataset.studies) || !dataset.studies.length ||
        !Array.isArray(dataset.categories) || !dataset.categories.length) {
      throw new Error('A complete assessment dataset is required.');
    }
    const isFramework = Array.isArray(dataset.topics);
    const scope = options.scope || dataset.defaultScope || 'vision';
    const category = options.category || 'all';
    const mode = options.weightMode || 'default';
    if (scope !== 'vision' && scope !== 'full') throw new Error('Unknown document scope.');
    if (!['default', 'equal', 'custom'].includes(mode)) throw new Error('Unknown weighting mode.');
    const categoryIds = new Set(dataset.categories.map(item => item.id));
    if (category !== 'all' && !categoryIds.has(category)) throw new Error(`Unknown assessment area: ${category}.`);
    const criterionIds = new Set(dataset.criteria.map(item => item.id));
    if (criterionIds.size !== dataset.criteria.length) throw new Error('Duplicate assessment criterion.');
    for (const criterion of dataset.criteria) {
      if (!categoryIds.has(categoryOf(criterion))) throw new Error(`Unknown area for criterion ${criterion.id}.`);
    }

    let baseWeights;
    if (isFramework) {
      if (mode === 'default') {
        baseWeights = normalize(Object.fromEntries(dataset.criteria.map(item => [item.id, item.defaultWeight])), 'Default criterion weights');
      } else {
        const topics = dataset.topics;
        if (!topics.length) throw new Error('Framework topics are required.');
        const topicWeights = mode === 'custom'
          ? customAllocation(topics, options.customWeights)
          : Object.fromEntries(topics.map(topic => [topic.id, 1 / topics.length]));
        baseWeights = {};
        for (const topic of topics) {
          if (!Array.isArray(topic.criterionIds) || !topic.criterionIds.length) {
            throw new Error(`Topic ${topic.id} has no assessment criteria.`);
          }
          for (const id of topic.criterionIds) {
            if (!criterionIds.has(id) || Object.hasOwn(baseWeights, id)) {
              throw new Error(`Invalid or duplicated topic criterion: ${id}.`);
            }
            baseWeights[id] = topicWeights[topic.id] / topic.criterionIds.length;
          }
        }
        if (Object.keys(baseWeights).length !== dataset.criteria.length) {
          throw new Error('Some assessment criteria have no topic weight.');
        }
      }
    } else {
      const areaWeights = mode === 'custom'
        ? customAllocation(dataset.categories, options.customWeights)
        : mode === 'equal'
          ? Object.fromEntries(dataset.categories.map(area => [area.id, 1 / dataset.categories.length]))
          : normalize(Object.fromEntries(dataset.categories.map(area => [area.id, area.defaultWeight])), 'Default governance weights');
      baseWeights = {};
      for (const area of dataset.categories) {
        const criteria = dataset.criteria.filter(item => categoryOf(item) === area.id);
        if (!criteria.length) throw new Error(`Area ${area.id} has no assessment criteria.`);
        for (const criterion of criteria) baseWeights[criterion.id] = areaWeights[area.id] / criteria.length;
      }
    }

    const weights = category === 'all'
      ? baseWeights
      : normalize(Object.fromEntries(dataset.criteria.map(item => [item.id,
          categoryOf(item) === category ? baseWeights[item.id] : 0])), 'Selected area weights');
    const categoryWeights = Object.fromEntries(dataset.categories.map(area => [area.id,
      sum(dataset.criteria.filter(item => categoryOf(item) === area.id).map(item => weights[item.id]))]));
    const referenceId = dataset.referenceId || dataset.studies.find(study => study.isReference)?.id;
    const reference = dataset.studies.find(study => study.id === referenceId);
    if (!reference) throw new Error('The Little Jamaica reference assessment is missing.');

    function rating(study, id) {
      const value = isFramework ? study.ratings?.[id]?.[scope] : study.ratings?.[id];
      if (!Number.isFinite(value) || (isFramework ? value < 1 || value > 5 : ![-1, 0, 1].includes(value))) {
        throw new Error(`Invalid ${isFramework ? scope : 'TOR'} rating for ${study.id}, ${id}.`);
      }
      return value;
    }
    // Validate the reference even when its relative score is always zero.
    for (const criterion of dataset.criteria) {
      if (!isFramework && rating(reference, criterion.id) !== 0) {
        throw new Error('The reference TOR must have zero relative ratings.');
      }
    }
    const localRaw = isFramework
      ? sum(dataset.criteria.map(item => weights[item.id] * rating(reference, item.id)))
      : null;
    const studies = dataset.studies.map(study => {
      const raw = isFramework
        ? sum(dataset.criteria.map(item => weights[item.id] * rating(study, item.id)))
        : null;
      const relative = nearZero(isFramework
        ? raw - localRaw
        : 12 * sum(dataset.criteria.map(item => weights[item.id] * rating(study, item.id))));
      const categories = dataset.categories.map(area => {
        const criteria = dataset.criteria.filter(item => categoryOf(item) === area.id);
        const weight = categoryWeights[area.id];
        const weightedRaw = sum(criteria.map(item => weights[item.id] * rating(study, item.id)));
        const weightedLocal = isFramework
          ? sum(criteria.map(item => weights[item.id] * rating(reference, item.id)))
          : 0;
        return {
          id: area.id,
          name: area.name,
          weight,
          value: nearZero(isFramework ? weightedRaw - weightedLocal : 12 * weightedRaw),
          raw: weight > 0 ? weightedRaw / weight : 0,
          localRaw: weight > 0 ? weightedLocal / weight : 0
        };
      });
      return { ...study, value: relative, raw, relative, categories };
    });
    return { studies, weights, categoryWeights, referenceId, scope, category, weightMode: mode, localRaw };
  }

  return Object.freeze({ calculate });
});
