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

import type {BlockNodeRecord} from '../immutable/BlockNodeRecord.js';
import type CharacterMetadata from '../immutable/CharacterMetadata.js';
import type {DraftBlockRenderMap} from '../immutable/DraftBlockRenderMap.js';
import type {DraftBlockType} from '../constants/DraftBlockType.js';
import type {EntityMap} from '../immutable/EntityMap.js';

const ContentBlock = require('../immutable/ContentBlock.js');
const ContentBlockNode = require('../immutable/ContentBlockNode.js');

const convertFromHTMLToContentBlocks = require('../encoding/convertFromHTMLToContentBlocks.js');
const generateRandomKey = require('../keys/generateRandomKey.js');
const getSafeBodyFromHTML = require('./getSafeBodyFromHTML.js');
const gkx = require('../../stubs/gkx.js');
const Immutable = require('immutable');
const sanitizeDraftText = require('../encoding/sanitizeDraftText.js');

const {List, Repeat} = Immutable;

const experimentalTreeDataSupport = gkx('draft_tree_data_support');
const ContentBlockRecord = experimentalTreeDataSupport
  ? ContentBlockNode
  : ContentBlock;

const DraftPasteProcessor = {
  processHTML(
    html: string,
    blockRenderMap?: DraftBlockRenderMap,
  ): ?{
    contentBlocks: ?Array<BlockNodeRecord>,
    entityMap: EntityMap,
    ...
  } {
    return convertFromHTMLToContentBlocks(
      html,
      getSafeBodyFromHTML,
      blockRenderMap,
    );
  },

  processText(
    textBlocks: Array<string>,
    character: CharacterMetadata,
    type: DraftBlockType,
  ): Array<BlockNodeRecord> {
    return textBlocks.reduce((acc, textLine, index) => {
      textLine = sanitizeDraftText(textLine);
      const key = generateRandomKey();

      let blockNodeConfig = {
        key,
        type,
        text: textLine,
        characterList: List(Repeat(character, textLine.length)),
      };

      // next block updates previous block
      if (experimentalTreeDataSupport && index !== 0) {
        const prevSiblingIndex = index - 1;
        // update previous block
        const previousBlock = (acc[prevSiblingIndex] = acc[
          prevSiblingIndex
        ].merge({
          nextSibling: key,
        }));
        blockNodeConfig = {
          ...blockNodeConfig,
          prevSibling: previousBlock.getKey(),
        };
      }

      acc.push(new ContentBlockRecord(blockNodeConfig));

      return acc;
    }, []);
  },
};

module.exports = DraftPasteProcessor;
