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

const Immutable = require('immutable');
const DraftOffsetKey = require('DraftOffsetKey');
const CharacterMetadata = require('CharacterMetadata');

const findAncestorWithOffsetKey = require('findAncestorWithOffsetKey');
const getOffsetKeyFromNode = require('getOffsetKeyFromNode');

/**
 * Reconstructs content block data from the current state of DOM and known editor state.
 * Preserves metadata (formatting) of individual chars, provided they can be mapped by offset key to the original state.
 * Use in combination with getReconstructedSelection in cases where
 * consistency of the DOM is not guaranteed after native edits.
 */
function getReconstructedBlock(
  block: ContentBlock,
  blockNode: Node,
  editorState: EditorState,
): ContentBlock {
  let text = '';
  let characterList: Array<CharacterMetadata> = [];

  const add = (nodeText: string, offsetKey: string | null) => {
    text += nodeText;

    // When the node is linked to original content, use its metadata to preserve formatting
    const metadata = offsetKey
      ? getMetadataForOffsetKey(offsetKey, editorState)
      : CharacterMetadata.EMPTY;

    characterList.push(...new Array(nodeText.length).fill(metadata));
  };

  // Loop through all text nodes to rebuild the block data
  const iterator = document.createNodeIterator(
    blockNode,
    // eslint-disable-next-line no-bitwise
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
    {
      acceptNode: node => {
        if (node.nodeType === Node.TEXT_NODE) {
          return NodeFilter.FILTER_ACCEPT;
        }
        if (node.nodeType === Node.ELEMENT_NODE && node.nodeName === 'BR') {
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_REJECT;
      },
    },
  );

  let node;
  while ((node = iterator.nextNode())) {
    const leafSpan = findAncestorWithOffsetKey(
      node,
      node => node.nodeName.toLowerCase() === 'span',
    );
    const offsetKey = leafSpan && getOffsetKeyFromNode(leafSpan);

    if (node.nodeType === Node.TEXT_NODE) {
      add(node.textContent, offsetKey);
    } else if (
      node.nodeType === Node.ELEMENT_NODE &&
      node.nodeName.toLowerCase() === 'br'
    ) {
      add('\n', offsetKey);
    }
  }

  return block.merge({
    text,
    characterList: Immutable.List(characterList),
  });
}

function getMetadataForOffsetKey(
  offsetKey: string,
  editorState: EditorState,
): CharacterMetadata {
  const {blockKey, decoratorKey, leafKey} = DraftOffsetKey.decode(offsetKey);

  const block = editorState.getCurrentContent().getBlockForKey(blockKey);
  if (!block) {
    return CharacterMetadata.EMPTY;
  }

  const {start} = editorState
    .getBlockTree(blockKey)
    .getIn([decoratorKey, 'leaves', leafKey]);

  return block.getCharacterList().get(start) ?? CharacterMetadata.EMPTY;
}

module.exports = getReconstructedBlock;
