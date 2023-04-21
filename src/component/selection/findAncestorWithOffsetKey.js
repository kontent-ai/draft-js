/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 * @flow strict-local
 * @emails oncall+draft_js
 */

'use strict';

const getCorrectDocumentFromNode = require('getCorrectDocumentFromNode');
const getOffsetKeyFromNode = require('getOffsetKeyFromNode');

/**
 * Gets the nearest ancestor with offset key, matching the given predicate.
 * If the predicate doesn't match, it continues searching.
 */
function findAncestorWithOffsetKey(
  node: Node,
  predicate: ?(node: node) => boolean,
): ?Node {
  let searchNode = node;
  while (
    searchNode &&
    searchNode !== getCorrectDocumentFromNode(node).documentElement
  ) {
    const key = getOffsetKeyFromNode(searchNode);
    if (key != null && (!predicate || predicate(searchNode))) {
      return searchNode;
    }
    searchNode = searchNode.parentNode;
  }
  return null;
}

module.exports = findAncestorWithOffsetKey;
