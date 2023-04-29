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
 * Get offset key from a node.
 */
const isElement = require('isElement');

function getOffsetKeyFromNode(node: Node): ?string {
  if (isElement(node)) {
    const castedNode: Element = (node: any);
    const offsetKey = castedNode.getAttribute('data-offset-key');
    if (offsetKey) {
      return offsetKey;
    }
  }
  return null;
}

module.exports = getOffsetKeyFromNode;
