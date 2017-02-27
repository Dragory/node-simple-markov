/**
 * @param {String} str
 * @returns {String[]}
 */
function defaultSplitIntoChunksFn(str) {
  const chunks = [];
  const regex = /^(?:[^\s.,!?]+|[\s.,!?]+)/i;

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

/**
 * @param {String[]} chunks
 * @return {String}
 */
function chunksToKey(chunks) {
  return JSON.stringify(chunks.map(w => w.toLowerCase()));
}

/**
 * @param {Function} addToTableFn
 * @param {String} str
 * @param {Object} options
 */
function parse(addToTableFn, str, options = {}) {
  const splitIntoChunksFn = options.splitIntoChunksFn || defaultSplitIntoChunksFn;
  const MAX_LOOKBEHIND = options.MAX_LOOKBEHIND || 2;
  const START_KEY = options.START_KEY || '__start__';
  const END_KEY = options.END_KEY || '__end__';

  const chunks = splitIntoChunksFn(str);

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
 * @param {Function} getNextChunkFn Function to return the next chunk for a key, i.e. key => string
 * @param {String[]} chunks Chunks to start with, defaults to empty array
 * @param {Object} options
 * @returns {Promise<String[]>}
 */
function generate(getNextChunkFn, chunks = [], options = {}) {
  const MAX_CHUNKS = options.MAX_CHUNKS || 30;
  const MAX_LOOKBEHIND = options.MAX_LOOKBEHIND || 2;
  const START_KEY = options.START_KEY || '__start__';

  function getNextChunk(chunks, lookbehind = MAX_LOOKBEHIND) {
    // If we're past the max length or can't find a next chunk (= lookbehind 0), bail out
    if (chunks.length > MAX_CHUNKS || lookbehind === 0) return chunks;

    let key;
    if (chunks.length === 0) {
      // If we're getting our first chunk, there's nothing to slice for the key. Use the predefined start key instead.
      key = START_KEY;
    } else {
      // Index to slice chunks from to get the key; if it's under 0, we can ignore it
      const lookbehindIndex = chunks.length - lookbehind
      if (lookbehindIndex < 0) return getNextChunk(chunks, lookbehind - 1);
      key = chunksToKey(chunks.slice(lookbehindIndex));
    }

    // Ask for the next chunk. If this fails, try again with a shorter lookbehind.
    return getNextChunkFn(key).then(chunk => {
      if (chunk == null) return getNextChunk(chunks, lookbehind - 1);
      return getNextChunk(chunks.concat(chunk));
    });
  }

  return getNextChunk(chunks);
}

module.exports = {
  defaultSplitIntoChunksFn,
  parse,
  generate,
};
