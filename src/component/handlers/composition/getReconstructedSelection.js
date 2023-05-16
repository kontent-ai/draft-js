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

import type {SelectionObject} from 'DraftDOMTypes';
import type DraftEditor from 'DraftEditor.react';

const DraftOffsetKey = require('DraftOffsetKey');
const SelectionState = require('SelectionState');

const findAncestorWithOffsetKey = require('findAncestorWithOffsetKey');
const getOffsetKeyFromNode = require('getOffsetKeyFromNode');

/**
 * Reconstructs selection based on the current DOM and DOM selection.
 * It locates the selection edges relatively from the root element for the given block,
 * so it returns valid selection even in case block child nodes have inconsistent metadata.
 * Use in combination with getReconstructedBlock in cases where
 * consistency of the DOM is not guaranteed after native edits.
 */
function getReconstructedSelection(
  editor: DraftEditor,
  contentState: ContentState,
): SelectionState {
  // at this point editor is not null for sure (after input)
  const castedEditorElement: HTMLElement = (editor.editor: any);
  const domSelection: SelectionObject = castedEditorElement.ownerDocument.defaultView.getSelection();

  const anchorPoint = getSelectionPoint(
    domSelection.anchorNode,
    domSelection.anchorOffset,
  ) ?? {
    blockKey: contentState.getFirstBlock().getKey(),
    offset: 0,
  };
  const focusPoint =
    getSelectionPoint(domSelection.focusNode, domSelection.focusOffset) ??
    anchorPoint;

  return SelectionState.createEmpty(anchorPoint.blockKey).merge({
    anchorOffset: anchorPoint.offset,
    focusKey: focusPoint.blockKey,
    focusOffset: focusPoint.offset,
    isBackward:
      (anchorPoint.blockKey === focusPoint.blockKey &&
        anchorPoint.offset > focusPoint.offset) ||
      contentState
        .getBlockMap()
        .keySeq()
        .skipUntil(v => v === anchorPoint.blockKey || v === focusPoint.blockKey)
        .first() === focusPoint.blockKey,
  });
}

function getSelectionPoint(
  selectionNode: Node,
  selectionOffset: number,
): {
  blockKey: string,
  offset: number,
} | null {
  const blockNode = findAncestorWithOffsetKey(selectionNode, node =>
    node.hasAttribute('data-block'),
  );
  if (!blockNode) {
    return null;
  }

  const offsetKey = getOffsetKeyFromNode(blockNode);
  const {blockKey} = DraftOffsetKey.decode(offsetKey);

  // Capture the offset relative to the block
  let offset = selectionOffset;
  let currentNode = selectionNode;

  while (currentNode && currentNode !== blockNode) {
    if (currentNode.previousSibling) {
      currentNode = currentNode.previousSibling;
      offset += currentNode.textContent.length;
    } else {
      currentNode = currentNode.parentNode;
    }
  }

  return {
    blockKey,
    offset,
  };
}

module.exports = getReconstructedSelection;
