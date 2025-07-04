/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 * @flow
 */

'use strict';

const AtomicBlockUtils = require('./model/modifier/AtomicBlockUtils.js');
const BlockMapBuilder = require('./model/immutable/BlockMapBuilder.js');
const CharacterMetadata = require('./model/immutable/CharacterMetadata.js');
const CompositeDraftDecorator = require('./model/decorators/CompositeDraftDecorator.js');
const ContentBlock = require('./model/immutable/ContentBlock.js');
const ContentState = require('./model/immutable/ContentState.js');
const DefaultDraftBlockRenderMap = require('./model/immutable/DefaultDraftBlockRenderMap.js');
const DefaultDraftInlineStyle = require('./model/immutable/DefaultDraftInlineStyle.js');
const DraftEditor = require('./component/base/DraftEditor.react.js');
const DraftEditorBlock = require('./component/contents/DraftEditorBlock.react.js');
const DraftEntity = require('./model/entity/DraftEntity.js');
const DraftModifier = require('./model/modifier/DraftModifier.js');
const DraftEntityInstance = require('./model/entity/DraftEntityInstance.js');
const EditorState = require('./model/immutable/EditorState.js');
const KeyBindingUtil = require('./component/utils/KeyBindingUtil.js');
const RawDraftContentState = require('./model/encoding/RawDraftContentState.js');
const RichTextEditorUtil = require('./model/modifier/RichTextEditorUtil.js');
const SelectionState = require('./model/immutable/SelectionState.js');

const convertFromDraftStateToRaw = require('./model/encoding/convertFromDraftStateToRaw.js');
const convertFromRawToDraftState = require('./model/encoding/convertFromRawToDraftState.js');
const generateRandomKey = require('./model/keys/generateRandomKey.js');
const getDefaultKeyBinding = require('./component/utils/getDefaultKeyBinding.js');
const getVisibleSelectionRect = require('./component/selection/getVisibleSelectionRect.js');

const convertFromHTML = require('./model/encoding/convertFromHTMLToContentBlocks.js');

const DraftPublic = {
  Editor: DraftEditor,
  EditorBlock: DraftEditorBlock,
  EditorState,

  CompositeDecorator: CompositeDraftDecorator,
  Entity: DraftEntity,
  EntityInstance: DraftEntityInstance,

  BlockMapBuilder,
  CharacterMetadata,
  ContentBlock,
  ContentState,
  RawDraftContentState,
  SelectionState,

  AtomicBlockUtils,
  KeyBindingUtil,
  Modifier: DraftModifier,
  RichUtils: RichTextEditorUtil,

  DefaultDraftBlockRenderMap,
  DefaultDraftInlineStyle,

  convertFromHTML,
  convertFromRaw: convertFromRawToDraftState,
  convertToRaw: convertFromDraftStateToRaw,
  genKey: generateRandomKey,
  getDefaultKeyBinding,
  getVisibleSelectionRect,
};

module.exports = DraftPublic;
