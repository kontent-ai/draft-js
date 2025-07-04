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

import type {BlockMap} from './BlockMap.js';
import type {BlockNodeRawConfig} from './BlockNode.js';
import type {BlockNodeRecord} from './BlockNodeRecord.js';
import type {ContentStateRawType} from './ContentStateRawType.js';
import type DraftEntityInstance from '../entity/DraftEntityInstance.js';
import type {DraftEntityMutability} from '../entity/DraftEntityMutability.js';
import type {DraftEntityType} from '../entity/DraftEntityType.js';
import type {Map} from 'immutable';

const BlockMapBuilder = require('./BlockMapBuilder.js');
const CharacterMetadata = require('./CharacterMetadata.js');
const ContentBlock = require('./ContentBlock.js');
const ContentBlockNode = require('./ContentBlockNode.js');
const DraftEntity = require('../entity/DraftEntity.js');
const SelectionState = require('./SelectionState.js');

const generateRandomKey = require('../keys/generateRandomKey.js');
const getOwnObjectValues = require('../../util/getOwnObjectValues.js');
const gkx = require('../../stubs/gkx.js');
const Immutable = require('immutable');
const sanitizeDraftText = require('../encoding/sanitizeDraftText.js');

const {List, Record, Repeat, Map: ImmutableMap, OrderedMap} = Immutable;

type ContentStateRecordType = {
  entityMap: ?any,
  blockMap: ?BlockMap,
  selectionBefore: ?SelectionState,
  selectionAfter: ?SelectionState,
  ...
};

const defaultRecord: ContentStateRecordType = {
  entityMap: null,
  blockMap: null,
  selectionBefore: null,
  selectionAfter: null,
};

const ContentStateRecord = (Record(defaultRecord): any);

/* $FlowFixMe[signature-verification-failure] Supressing a `signature-
 * verification-failure` error here. TODO: T65949050 Clean up the branch for
 * this GK */
const ContentBlockNodeRecord = gkx('draft_tree_data_support')
  ? ContentBlockNode
  : ContentBlock;

class ContentState extends ContentStateRecord {
  getEntityMap(): any {
    // TODO: update this when we fully remove DraftEntity
    return DraftEntity;
  }

  getBlockMap(): BlockMap {
    return this.get('blockMap');
  }

  getSelectionBefore(): SelectionState {
    return this.get('selectionBefore');
  }

  getSelectionAfter(): SelectionState {
    return this.get('selectionAfter');
  }

  getBlockForKey(key: string): BlockNodeRecord {
    const block: BlockNodeRecord = this.getBlockMap().get(key);
    return block;
  }

  getKeyBefore(key: string): ?string {
    return this.getBlockMap()
      .reverse()
      .keySeq()
      .skipUntil(v => v === key)
      .skip(1)
      .first();
  }

  getKeyAfter(key: string): ?string {
    return this.getBlockMap()
      .keySeq()
      .skipUntil(v => v === key)
      .skip(1)
      .first();
  }

  getBlockAfter(key: string): ?BlockNodeRecord {
    return this.getBlockMap()
      .skipUntil((_, k) => k === key)
      .skip(1)
      .first();
  }

  getBlockBefore(key: string): ?BlockNodeRecord {
    return this.getBlockMap()
      .reverse()
      .skipUntil((_, k) => k === key)
      .skip(1)
      .first();
  }

  getBlocksAsArray(): Array<BlockNodeRecord> {
    return this.getBlockMap().toArray();
  }

  getFirstBlock(): BlockNodeRecord {
    return this.getBlockMap().first();
  }

  getLastBlock(): BlockNodeRecord {
    return this.getBlockMap().last();
  }

  getPlainText(delimiter?: string): string {
    return this.getBlockMap()
      .map(block => {
        return block ? block.getText() : '';
      })
      .join(delimiter || '\n');
  }

  getLastCreatedEntityKey(): string {
    // TODO: update this when we fully remove DraftEntity
    return DraftEntity.__getLastCreatedEntityKey();
  }

  hasText(): boolean {
    const blockMap = this.getBlockMap();
    return (
      blockMap.size > 1 ||
      // make sure that there are no zero width space chars
      escape(blockMap.first().getText()).replace(/%u200B/g, '').length > 0
    );
  }

  createEntity(
    type: DraftEntityType,
    mutability: DraftEntityMutability,
    data?: Object,
  ): ContentState {
    // TODO: update this when we fully remove DraftEntity
    DraftEntity.__create(type, mutability, data);
    return this;
  }

  mergeEntityData(
    key: string,
    toMerge: {[key: string]: any, ...},
  ): ContentState {
    // TODO: update this when we fully remove DraftEntity
    DraftEntity.__mergeData(key, toMerge);
    return this;
  }

  replaceEntityData(
    key: string,
    newData: {[key: string]: any, ...},
  ): ContentState {
    // TODO: update this when we fully remove DraftEntity
    DraftEntity.__replaceData(key, newData);
    return this;
  }

  addEntity(instance: DraftEntityInstance): ContentState {
    // TODO: update this when we fully remove DraftEntity
    DraftEntity.__add(instance);
    return this;
  }

  getEntity(key: string): DraftEntityInstance {
    // TODO: update this when we fully remove DraftEntity
    return DraftEntity.__get(key);
  }

  getAllEntities(): Map<string, DraftEntityInstance> {
    return DraftEntity.__getAll();
  }

  loadWithEntities(entities: Map<string, DraftEntityInstance>): void {
    return DraftEntity.__loadWithEntities(entities);
  }

  static createFromBlockArray(
    // TODO: update flow type when we completely deprecate the old entity API
    blocks:
      | Array<BlockNodeRecord>
      | {contentBlocks: Array<BlockNodeRecord>, ...},
    entityMap: ?any,
  ): ContentState {
    // TODO: remove this when we completely deprecate the old entity API
    const theBlocks = Array.isArray(blocks) ? blocks : blocks.contentBlocks;
    const blockMap = BlockMapBuilder.createFromArray(theBlocks);
    const selectionState = blockMap.isEmpty()
      ? new SelectionState()
      : SelectionState.createEmpty(blockMap.first().getKey());
    return new ContentState({
      blockMap,
      entityMap: entityMap || DraftEntity,
      selectionBefore: selectionState,
      selectionAfter: selectionState,
    });
  }

  static createFromText(
    text: string,
    delimiter: string | RegExp = /\r\n?|\n/g,
  ): ContentState {
    const strings = text.split(delimiter);
    const blocks = strings.map(block => {
      block = sanitizeDraftText(block);
      return new ContentBlockNodeRecord({
        key: generateRandomKey(),
        text: block,
        type: 'unstyled',
        characterList: List(Repeat(CharacterMetadata.EMPTY, block.length)),
      });
    });
    return ContentState.createFromBlockArray(blocks);
  }

  static fromJS(state: ContentStateRawType): ContentState {
    return new ContentState({
      ...state,
      blockMap: OrderedMap(state.blockMap).map(
        ContentState.createContentBlockFromJS,
      ),
      selectionBefore: new SelectionState(state.selectionBefore),
      selectionAfter: new SelectionState(state.selectionAfter),
    });
  }

  static createContentBlockFromJS(
    block: BlockNodeRawConfig,
  ): ContentBlockNodeRecord {
    const characterList = block.characterList;

    return new ContentBlockNodeRecord({
      ...block,
      data: ImmutableMap(block.data),
      characterList:
        characterList != null
          ? List(
              (Array.isArray(characterList)
                ? characterList
                : getOwnObjectValues(characterList)
              ).map(c => CharacterMetadata.fromJS(c)),
            )
          : undefined,
    });
  }
}

module.exports = ContentState;
