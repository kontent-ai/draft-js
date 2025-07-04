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

const DraftModifier = require('../../../../model/modifier/DraftModifier.js');
const EditorState = require('../../../../model/immutable/EditorState.js');

function keyCommandInsertNewline(editorState: EditorState): EditorState {
  const contentState = DraftModifier.splitBlock(
    editorState.getCurrentContent(),
    editorState.getSelection(),
  );
  return EditorState.push(editorState, contentState, 'split-block');
}

module.exports = keyCommandInsertNewline;
