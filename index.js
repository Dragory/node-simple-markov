/**
 * @param {String} str
 * @returns {String[]}
 */
function defaultSplitIntoChunksFn(str) {
  const chunks = [];
  const regex = /^(?:[a-z0-9]+|[^a-z0-9])/i;

  let lastIndex = 0;
  let match = true;
  while (match) {
    match = str.slice(lastIndex).match(regex);

    if (match) {
      chunks.push(match[0]);
      lastIndex += match[0].length;
      if (lastIndex >= str.length) break;
    } else {
      const lastChunk = str.slice(lastIndex);
      if (lastChunk !== '') chunks.push();
    }
  }

  return chunks;
}

function chunksToKey(chunks) {
  return JSON.stringify(chunks.map(w => w.toLowerCase()));
}

/**
 * @param {Function} addToTableFn
 * @param {String} str
 * @param {Object} options
 */
function parse(addToTableFn, str, options = {}) {
  const splitIntoChunks = options.splitIntoChunks || defaultSplitIntoChunksFn;
  const MAX_LOOKBEHIND = options.MAX_LOOKBEHIND || 2;
  const START_KEY = options.START_PART_KEY || '__start__';
  const END_KEY = options.END_PART_KEY || '__end__';

  const chunks = splitIntoChunks(str);

  function processNextChunk(chunks, i = 0) {
    const chunk = chunks[i];
    if (chunk == null) return;

    if (i === 0) {
      return addToTableFn(START_KEY, chunk).then(() => processNextChunk(chunks, i + 1));
    }

    let promises = [];
    for (let currentLookbehind = 1; currentLookbehind <= MAX_LOOKBEHIND; currentLookbehind++) {
      const lookbehindIndex = i - currentLookbehind;
      if (lookbehindIndex < 0) continue;

      const key = chunksToKey(chunks.slice(lookbehindIndex, lookbehindIndex + currentLookbehind));
      promises.push(addToTableFn(key, chunk));
    }

    if (i === chunks.length - 1) {
      promises.push(addToTableFn(chunk, END_KEY));
    }

    return Promise.all(promises).then(() => processNextChunk(chunks, i + 1));
  }

  return processNextChunk(chunks);
}

/**
 * @param {Function} getNextChunkFn
 * @param {Number} maxLength
 * @param {String[]} chunks
 * @returns {Promise<String[]>}
 */
function generate(getNextChunkFn, maxLength = 30, chunks = []) {
  function getNextChunk(chunks, maxLength) {
    return getNextChunkFn(chunks).then(chunk => {
      if (chunks.length > maxLength || chunk === null) return chunks;
      return getNextChunk(chunks.concat(chunk), maxLength);
    });
  }

  return getNextChunk(chunks, maxLength);
}

module.exports = {
  defaultSplitIntoChunksFn,
  chunksToKey,
  parse,
  generate,
};
