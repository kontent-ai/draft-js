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

import type DraftEditor from 'DraftEditor.react';

const Keys = require('Keys');

const onBeforeInput = require('editOnBeforeInput');
const onBlur = require('editOnBlur');
const onCompositionStart = require('editOnCompositionStart');
const onCopy = require('editOnCopy');
const onCut = require('editOnCut');
const onDragOver = require('editOnDragOver');
const onDragStart = require('editOnDragStart');
const onFocus = require('editOnFocus');
const onInput = require('editOnInput');
const onKeyDown = require('editOnKeyDown');
const onPaste = require('editOnPaste');
const onSelect = require('editOnSelect');

const keysDown: Set<number> = new Set();

function markTrackedKeyDown(e: SyntheticKeyboardEvent<HTMLElement>) {
  const keyCode = e.which;
  switch (keyCode) {
    // We are tracking only keys that may change selection without changing content
    case Keys.UP:
    case Keys.RIGHT:
    case Keys.DOWN:
    case Keys.LEFT:
    case Keys.PAGE_UP:
    case Keys.PAGE_DOWN:
    case Keys.HOME:
    case Keys.END:
      keysDown.add(keyCode);
      break;
  }
}

function markKeyUp(e: SyntheticKeyboardEvent<HTMLElement>) {
  keysDown.delete(e.which);
}

let mouseButtonsDown = 0;

function updateMouseButtons(editor: DraftEditor, e: SyntheticMouseEvent) {
  mouseButtonsDown = e.buttons;
}

const DraftEditorEditHandler = {
  onBeforeInput: (editor, e) => {
    // Selection event may not fire if one starts typing before mouse/key up, so in this case we need to update the selection first
    // otherwise the editor content could be malformed and handleBeforeInput could get incorrect selection
    if (mouseButtonsDown || keysDown.size) {
      onSelect(editor);
    }
    onBeforeInput(editor, e);
  },
  onBlur,
  onCompositionStart,
  onCopy,
  onCut,
  onDragOver,
  onDragStart,
  onFocus,
  onInput,
  onPaste,
  onSelect,

  // In certain cases, contenteditable does not fire the onSelect
  // event, causing problems with cursor positioning. Therefore, the selection
  // state update handler is added to more events to ensure that the selection
  // state is always synced with the current cursor positions.
  // We also need to track the status of keys and mouse buttons to properly handle selection in input events, see above
  onMouseDown: updateMouseButtons,
  onMouseUp: (editor: DraftEditor, e: SyntheticMouseEvent) => {
    updateMouseButtons(editor, e);
    onSelect(editor);
  },
  onKeyDown: (editor: DraftEditor, e: SyntheticKeyboardEvent<HTMLElement>) => {
    markTrackedKeyDown(e);
    onKeyDown(editor, e);
  },
  onKeyUp: (editor: DraftEditor, e: SyntheticKeyboardEvent<HTMLElement>) => {
    markKeyUp(e);
    onSelect(editor);
  },
};

module.exports = DraftEditorEditHandler;
