'use strict';

import type SelectionRange from 'SelectionRange';

const Immutable = require('immutable');

const {List} = Immutable;

function getSelectionRanges(
  block: ContentBlock,
  nextBlock: ContentBlock | undefined,
): List<SelectionRange> | null {
  const selections = block.getSelections();
  const length = block.getLength();
  const characterIds = block.getCharacterIds();

  if (!selections || selections.isEmpty()) {
    return null;
  }
  const blockId = block.getId();
  const nextBlockId = nextBlock && nextBlock.getId();

  // Index of first char after the caret is the caret offset. If none found, it defaults to the end of the block
  const getIdOffset = (id: string) => {
    const charOffset = characterIds.findIndex(charId => id < charId);
    if (charOffset < 0) {
      return length;
    }
    return charOffset;
  };

  const result = List().withMutations(ranges => {
    selections.forEach(selection => {
      const anchorId = selection.getAnchorId();
      const focusId = selection.getFocusId();

      const isBackward = anchorId > focusId;
      const startId = isBackward ? focusId : anchorId;
      const endId = isBackward ? anchorId : focusId;

      const isStartWithin =
        startId >= blockId && (!nextBlockId || startId < nextBlockId);

      const isEndWithin =
        endId >= blockId && (!nextBlockId || endId < nextBlockId);

      const isFullyInside =
        startId < blockId && nextBlockId && endId >= nextBlockId;

      if (isStartWithin || isEndWithin || isFullyInside) {
        const startOffset = isStartWithin ? getIdOffset(startId) : -1;
        const endOffset = isEndWithin ? getIdOffset(endId) : -1;

        if (startOffset >= 0 && endOffset >= 0) {
          // Fully inside this block
          ranges.push({
            startOffset,
            endOffset,
            focusOffset: isBackward ? startOffset : endOffset,
            selection,
          });
        } else if (startOffset >= 0) {
          // In this block and continues after it
          ranges.push({
            startOffset,
            endOffset: length,
            focusOffset: isBackward ? startOffset : null,
            selection,
          });
        } else if (endOffset >= 0) {
          // In this block and continues before it
          ranges.push({
            startOffset: 0,
            endOffset,
            focusOffset: isBackward ? null : endOffset,
            selection,
          });
        } else {
          // This block is inside and it continues to both sides outside the block
          ranges.push({
            startOffset: 0,
            endOffset: length,
            focusOffset: null,
            selection,
          });
        }
      }
    });
  });

  return result;
}

module.exports = getSelectionRanges;
