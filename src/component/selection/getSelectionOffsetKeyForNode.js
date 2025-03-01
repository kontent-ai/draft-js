/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 * @flow
 * @emails oncall+draft_js
 */

'use strict';

/**
 * Get offset key from a node or it's child nodes. Return the first offset key
 * found on the DOM tree of given node.
 */
const isElement = require('isElement');
const getOffsetKeyFromNode = require('getOffsetKeyFromNode');

function getSelectionOffsetKeyForNode(node: Node): ?string {
  if (isElement(node)) {
    const offsetKey = getOffsetKeyFromNode(node);
    if (offsetKey) {
      return offsetKey;
    }
    const castedNode: Element = (node: any);
    for (let ii = 0; ii < castedNode.childNodes.length; ii++) {
      const childOffsetKey = getSelectionOffsetKeyForNode(
        castedNode.childNodes[ii],
      );
      if (childOffsetKey) {
        return childOffsetKey;
      }
    }
  }
  return null;
}

module.exports = getSelectionOffsetKeyForNode;
