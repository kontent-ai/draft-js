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
 * Gets the nearest ancestor with offset key.
 */
function findAncestorWithOffsetKey(node: Node): ?Node {
  let searchNode = node;
  while (
    searchNode &&
    searchNode !== getCorrectDocumentFromNode(node).documentElement
  ) {
    const key = getOffsetKeyFromNode(searchNode);
    if (key != null) {
      return searchNode;
    }
    searchNode = searchNode.parentNode;
  }
  return null;
}

module.exports = findAncestorWithOffsetKey;
