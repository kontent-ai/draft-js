/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @emails oncall+draft_js
 * @flow strict-local
 * @format
 */

'use strict';

const ContentBlock = require('../../../../model/immutable/ContentBlock.js');
const ContentState = require('../../../../model/immutable/ContentState.js');
const EditorState = require('../../../../model/immutable/EditorState.js');

const onInput = require('../editOnInput.js');

jest.mock('../../../selection/findAncestorOffsetKey.js', () => jest.fn(() => 'blockkey-0-0'));
jest.mock('../commands/keyCommandPlainBackspace.js', () => jest.fn(() => ({})));

const getEditorState = (text = '') => {
  return EditorState.createWithContent(
    ContentState.createFromBlockArray([
      new ContentBlock({
        key: 'blockkey',
        text,
      }),
    ]),
  );
};

function withGlobalGetSelectionAs(getSelectionValue = {}, callback) {
  const oldGetSelection = global.getSelection;
  try {
    global.getSelection = () => getSelectionValue;
    callback();
  } finally {
    global.getSelection = oldGetSelection;
  }
}

test('restoreEditorDOM and keyCommandPlainBackspace are NOT called when the `inputType` is not from a backspace press', () => {
  const anchorNodeText = 'react draftjs';
  const globalSelection = {
    anchorNode: document.createTextNode(anchorNodeText),
  };
  withGlobalGetSelectionAs(globalSelection, () => {
    const editorState = getEditorState(anchorNodeText);
    const editorNode = document.createElement('div');
    const editor = {
      _latestEditorState: editorState,
      props: {},
      update: jest.fn(),
      restoreEditorDOM: jest.fn(),
      editor: editorNode,
    };

    const inputEvent = {
      nativeEvent: {inputType: 'insetText'},
      currentTarget: editorNode,
    };

    // $FlowExpectedError[incompatible-call]
    onInput(editor, inputEvent);

    expect(require('../commands/keyCommandPlainBackspace.js')).toHaveBeenCalledTimes(0);
    expect(editor.restoreEditorDOM).toHaveBeenCalledTimes(0);
    expect(editor.update).toHaveBeenCalledTimes(0);
  });
});

test('restoreEditorDOM and keyCommandPlainBackspace are called when backspace is pressed', () => {
  const anchorNodeText = 'react draftjs';
  const globalSelection = {
    anchorNode: document.createTextNode(anchorNodeText),
  };
  withGlobalGetSelectionAs(globalSelection, () => {
    const editorState = getEditorState(anchorNodeText);
    const editorNode = document.createElement('div');
    const editor = {
      _latestEditorState: editorState,
      props: {},
      update: jest.fn(),
      restoreEditorDOM: jest.fn(),
      editor: editorNode,
    };

    const inputEvent = {
      // When Backspace is pressed and input-type is supported, an event with
      // inputType === 'deleteContentBackward' is triggered by the browser.
      nativeEvent: {inputType: 'deleteContentBackward'},
      currentTarget: editorNode,
    };

    // $FlowExpectedError[incompatible-call]
    onInput(editor, inputEvent);

    // $FlowExpectedError[prop-missing]
    const newEditorState = require('../commands/keyCommandPlainBackspace.js').mock.results[0]
      .value;
    expect(require('../commands/keyCommandPlainBackspace.js')).toHaveBeenCalledWith(
      editorState,
    );
    expect(editor.restoreEditorDOM).toHaveBeenCalledTimes(1);
    expect(editor.update).toHaveBeenCalledWith(newEditorState);
  });
});
