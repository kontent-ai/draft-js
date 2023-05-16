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

const DOMObserver = require('DOMObserver');
const ContentState = require('ContentState');
const EditorState = require('EditorState');
const Keys = require('Keys');

const editOnSelect = require('editOnSelect');
const getContentEditableContainer = require('getContentEditableContainer');
const getReconstructedBlock = require('getReconstructedBlock');
const getReconstructedSelection = require('getReconstructedSelection');
const nullthrows = require('nullthrows');

/**
 * Millisecond delay to allow `compositionstart` to fire again upon
 * `compositionend`.
 *
 * This is used for Korean input to ensure that typing can continue without
 * the editor trying to render too quickly. More specifically, Safari 7.1+
 * triggers `compositionstart` a little slower than Chrome/FF, which
 * leads to composed characters being resolved and re-render occurring
 * sooner than we want.
 */
const RESOLVE_DELAY = 20;

/**
 * A handful of variables used to track the current composition and its
 * resolution status. These exist at the module level because it is not
 * possible to have compositions occurring in multiple editors simultaneously,
 * and it simplifies state management with respect to the DraftEditor component.
 */
let resolved = false;
let stillComposing = false;
let domObserver: DOMObserver | null = null;
let selectionAtCompositionStart: SelectionState | null = null;

function startDOMObserver(editor: DraftEditor) {
  if (!domObserver) {
    domObserver = new DOMObserver(getContentEditableContainer(editor));
    domObserver.start();
  }
}

const DraftEditorCompositionHandler = {
  /**
   * When the composition finished but there is still some input before the editor switches
   * to the standard handler, we ignore it.
   * This may happen in case you type some text during composition, undo it, and press ESC to close IME
   * Observed in Chrome.
   */
  onBeforeInput(editor: DraftEditor, event: SyntheticInputEvent<>): void {
    if (!stillComposing) {
      event.preventDefault();
    }
  },

  /**
   * A `compositionstart` event has fired while we're still in composition
   * mode. Continue the current composition session to prevent a re-render.
   */
  onCompositionStart(editor: DraftEditor): void {
    stillComposing = true;
    selectionAtCompositionStart = editor._latestEditorState.getSelection();
    startDOMObserver(editor);
  },

  /**
   * Attempt to end the current composition session.
   *
   * Defer handling because browser will still insert the chars into active
   * element after `compositionend`. If a `compositionstart` event fires
   * before `resolveComposition` executes, our composition session will
   * continue.
   *
   * The `resolved` flag is useful because certain IME interfaces fire the
   * `compositionend` event multiple times, thus queueing up multiple attempts
   * at handling the composition. Since handling the same composition event
   * twice could break the DOM, we only use the first event. Example: Arabic
   * Google Input Tools on Windows 8.1 fires `compositionend` three times.
   */
  onCompositionEnd(editor: DraftEditor): void {
    if (stillComposing) {
      resolved = false;
      stillComposing = false;
      setTimeout(() => {
        if (!resolved) {
          DraftEditorCompositionHandler.resolveComposition(editor);
        }
      }, RESOLVE_DELAY);
    }
  },

  onSelect: editOnSelect,

  /**
   * In Safari, keydown events may fire when committing compositions. If
   * the arrow keys are used to commit, prevent default so that the cursor
   * doesn't move, otherwise it will jump back noticeably on re-render.
   */
  onKeyDown(editor: DraftEditor, e: SyntheticKeyboardEvent<>): void {
    if (!stillComposing) {
      // If a keydown event is received after compositionend but before the
      // 20ms timer expires (ex: type option-E then backspace, or type A then
      // backspace in 2-Set Korean), we should immediately resolve the
      // composition and reinterpret the key press in edit mode.
      DraftEditorCompositionHandler.resolveComposition(editor);
      editor._onKeyDown(e);
      return;
    } else if (!e.nativeEvent.isComposing) {
      // In some cases, the `compositionend` event may not fire but composition ends anyway.
      // E.g. in Chrome when you type some text during composition, then undo with CTRL+Z
      // and exit the composition with ESC
      // Thus when we receive an event without isComposing flag, we need to end the composition
      e.preventDefault();
      DraftEditorCompositionHandler.onCompositionEnd(editor);
      return;
    }

    if (e.which === Keys.RIGHT || e.which === Keys.LEFT) {
      e.preventDefault();
    }
  },

  /**
   * Keypress events may fire when committing compositions. In Firefox,
   * pressing RETURN commits the composition and inserts extra newline
   * characters that we do not want. `preventDefault` allows the composition
   * to be committed while preventing the extra characters.
   */
  onKeyPress(_editor: DraftEditor, e: SyntheticKeyboardEvent<>): void {
    if (e.which === Keys.RETURN) {
      e.preventDefault();
    }
  },

  /**
   * Attempt to insert composed characters into the document.
   *
   * If we are still in a composition session, do nothing. Otherwise, insert
   * the characters into the document and terminate the composition session.
   *
   * If no characters were composed -- for instance, the user
   * deleted all composed characters and committed nothing new --
   * force a re-render. We also re-render when the composition occurs
   * at the beginning of a leaf, to ensure that if the browser has
   * created a new text node for the composition, we will discard it.
   *
   * Resetting innerHTML will move focus to the beginning of the editor,
   * so we update to force it back to the correct place.
   */
  resolveComposition(editor: DraftEditor): void {
    if (stillComposing) {
      return;
    }

    const mutations = nullthrows(domObserver).stopAndFlushMutations();
    domObserver = null;
    resolved = true;

    const editorState = EditorState.set(editor._latestEditorState, {
      inCompositionMode: false,
      // As resolving composition happens asynchronously, the editor selection
      // may be already updated via `editOnSelect` after the composed chars are inserted
      // To get consistent selection handling for undo, we use the original selection instead.
      selection: selectionAtCompositionStart || editorState.getSelection(),
    });
    selectionAtCompositionStart = null;

    editor.exitCurrentMode();

    if (!mutations.size) {
      editor.update(editorState);
      return;
    }

    // TODO, check if Facebook still needs this flag or if it could be removed.
    // Since there can be multiple mutations providing a `composedChars` doesn't
    // apply well on this new model.
    // if (
    //   gkx('draft_handlebeforeinput_composed_text') &&
    //   editor.props.handleBeforeInput &&
    //   isEventHandled(
    //     editor.props.handleBeforeInput(
    //       composedChars,
    //       editorState,
    //       event.timeStamp,
    //     ),
    //   )
    // ) {
    //   return;
    // }

    const contentState = editorState.getCurrentContent();
    const blocks = contentState.getBlocksAsArray();
    const newBlocks = blocks
      .map(block => {
        const blockKey = block.getKey();
        if (!mutations.has(blockKey)) {
          return block;
        }

        // No longer existing blocks are completely removed
        const blockNode = mutations.get(blockKey);
        if (!blockNode) {
          return null;
        }

        // For blocks with some mutations detected, we reconstruct the block content based on the current DOM
        // while preserving the metadata from original editorState based on the original leaf offset keys (if found).
        // For completely anonymous text nodes we just keep the text with empty metadata.
        return getReconstructedBlock(block, blockNode, editorState);
      })
      .filter(block => !!block);

    const newContentState = ContentState.createFromBlockArray(
      newBlocks,
      contentState.getEntityMap(),
    );

    // We need to reconstruct the selection based on relative offset from the block,
    // as the rendered content metadata may be malformed at this point.
    const finalSelection = getReconstructedSelection(editor, newContentState);

    // Set proper metadata to content and editor state to properly handle undo
    const newContentStateWithSelection = newContentState.merge({
      selectionBefore: editorState.getSelection(),
      selectionAfter: finalSelection,
    });
    const newEditorState = EditorState.push(
      editorState,
      newContentStateWithSelection,
      newBlocks.length !== blocks.length ? 'remove-range' : 'insert-characters',
    );

    const newEditorStateWithSelection = EditorState.forceSelection(
      newEditorState,
      finalSelection,
    );

    // We need to remount the editor DOM to a consistent state before it is re-rendered to avoid rendering inconsistencies
    editor.restoreEditorDOM();
    editor.update(newEditorStateWithSelection);
  },
};

module.exports = DraftEditorCompositionHandler;
