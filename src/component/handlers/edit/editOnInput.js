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

import type {SelectionObject} from 'DraftDOMTypes';
import type DraftEditor from 'DraftEditor.react';

const DraftModifier = require('DraftModifier');
const DraftOffsetKey = require('DraftOffsetKey');
const EditorState = require('EditorState');
const UserAgent = require('UserAgent');

const {notEmptyKey} = require('draftKeyUtils');
const findAncestorOffsetKey = require('findAncestorOffsetKey');
const findAncestorWithOffsetKey = require('findAncestorWithOffsetKey');
const keyCommandPlainBackspace = require('keyCommandPlainBackspace');
const nullthrows = require('nullthrows');

const isGecko = UserAgent.isEngine('Gecko');

const DOUBLE_NEWLINE = '\n\n';

function onInputType(inputType: string, editorState: EditorState): EditorState {
  switch (inputType) {
    case 'deleteContentBackward':
      return keyCommandPlainBackspace(editorState);
  }
  return editorState;
}

/**
 * This function serves two purposes
 *
 * 1. To update the editorState and call onChange method with the new
 * editorState. This editorState is calculated in editOnBeforeInput but the
 * onChange method is not called with the new state until this method does it.
 * It is done to handle a specific case where certain character inputs might
 * be replaced with something else. E.g. snippets ('rc' might be replaced
 * with boilerplate code for react component). More information on the
 * exact problem can be found here -
 * https://github.com/facebook/draft-js/commit/07892ba479bd4dfc6afd1e0ed179aaf51cd138b1
 *
 * 2. intended to handle spellcheck and autocorrect changes,
 * which occur in the DOM natively without any opportunity to observe or
 * interpret the changes before they occur.
 *
 * The `input` event fires in contentEditable elements reliably for non-IE
 * browsers, immediately after changes occur to the editor DOM. Since our other
 * handlers override or otherwise handle cover other varieties of text input,
 * the DOM state should match the model in all controlled input cases. Thus,
 * when an `input` change leads to a DOM/model mismatch, the change should be
 * due to a spellcheck change, and we can incorporate it into our model.
 */
function editOnInput(editor: DraftEditor, e: SyntheticInputEvent<>): void {
  if (editor._pendingStateFromBeforeInput !== undefined) {
    editor.update(editor._pendingStateFromBeforeInput);
    editor._pendingStateFromBeforeInput = undefined;
  }

  reconcileTextNodesAtSelection(editor);

  const domSelection = getDomSelection(editor);
  const {anchorNode, isCollapsed} = domSelection;

  const isNotTextOrElementNode =
    anchorNode?.nodeType !== Node.TEXT_NODE &&
    anchorNode?.nodeType !== Node.ELEMENT_NODE;

  if (anchorNode == null || isNotTextOrElementNode) {
    // TODO: (t16149272) figure out context for this change
    return;
  }

  let domText = anchorNode.textContent;
  const editorState = editor._latestEditorState;
  const offsetKey = nullthrows(findAncestorOffsetKey(anchorNode));
  const {blockKey, decoratorKey, leafKey} = DraftOffsetKey.decode(offsetKey);

  const {start, end} = editorState
    .getBlockTree(blockKey)
    .getIn([decoratorKey, 'leaves', leafKey]);

  const content = editorState.getCurrentContent();
  const block = content.getBlockForKey(blockKey);
  const modelText = block.getText().slice(start, end);

  // Special-case soft newlines here. If the DOM text ends in a soft newline,
  // we will have manually inserted an extra soft newline in DraftEditorLeaf.
  // We want to remove this extra newline for the purpose of our comparison
  // of DOM and model text.
  if (domText.endsWith(DOUBLE_NEWLINE)) {
    domText = domText.slice(0, -1);
  }

  // No change -- the DOM is up to date. Nothing to do here.
  if (domText === modelText) {
    // This can be buggy for some Android keyboards because they don't fire
    // standard onkeydown/pressed events and only fired editOnInput
    // so domText is already changed by the browser and ends up being equal
    // to modelText unexpectedly.
    // Newest versions of Android support the dom-inputevent-inputtype
    // and we can use the `inputType` to properly apply the state changes.

    /* $FlowFixMe[prop-missing] inputType is only defined on a draft of a
     * standard. https://w3c.github.io/input-events/#dom-inputevent-inputtype
     */
    const {inputType} = e.nativeEvent;
    if (inputType) {
      const newEditorState = onInputType(inputType, editorState);
      if (newEditorState !== editorState) {
        editor.restoreEditorDOM();
        editor.update(newEditorState);
        return;
      }
    }
    return;
  }

  const selection = editorState.getSelection();

  // We'll replace the entire leaf with the text content of the target.
  const targetRange = selection.merge({
    anchorOffset: start,
    focusOffset: end,
    isBackward: false,
  });

  const entityKey = block.getEntityAt(start);
  const entity = notEmptyKey(entityKey) ? content.getEntity(entityKey) : null;
  const entityType = entity != null ? entity.getMutability() : null;
  const preserveEntity = entityType === 'MUTABLE';

  // Immutable or segmented entities cannot properly be handled by the
  // default browser undo, so we have to use a different change type to
  // force using our internal undo method instead of falling through to the
  // native browser undo.
  const changeType = preserveEntity ? 'spellcheck-change' : 'apply-entity';

  const newContent = DraftModifier.replaceText(
    content,
    targetRange,
    domText,
    block.getInlineStyleAt(start),
    preserveEntity ? block.getEntityAt(start) : null,
  );

  let anchorOffset, focusOffset, startOffset, endOffset;

  if (isGecko) {
    // Firefox selection does not change while the context menu is open, so
    // we preserve the anchor and focus values of the DOM selection.
    anchorOffset = domSelection.anchorOffset;
    focusOffset = domSelection.focusOffset;
    startOffset = start + Math.min(anchorOffset, focusOffset);
    endOffset = startOffset + Math.abs(anchorOffset - focusOffset);
    anchorOffset = startOffset;
    focusOffset = endOffset;
  } else {
    // Browsers other than Firefox may adjust DOM selection while the context
    // menu is open, and Safari autocorrect is prone to providing an inaccurate
    // DOM selection. Don't trust it. Instead, use our existing SelectionState
    // and adjust it based on the number of characters changed during the
    // mutation.
    const charDelta = domText.length - modelText.length;
    startOffset = selection.getStartOffset();
    endOffset = selection.getEndOffset();

    anchorOffset = isCollapsed ? endOffset + charDelta : startOffset;
    focusOffset = endOffset + charDelta;
  }

  // Segmented entities are completely or partially removed when their
  // text content changes. For this case we do not want any text to be selected
  // after the change, so we are not merging the selection.
  const contentWithAdjustedDOMSelection = newContent.merge({
    selectionBefore: content.getSelectionAfter(),
    selectionAfter: selection.merge({anchorOffset, focusOffset}),
  });

  editor.update(
    EditorState.push(editorState, contentWithAdjustedDOMSelection, changeType),
  );
}

function reconcileTextNodesAtSelection(editor: DraftEditor): void {
  const domSelection = getDomSelection(editor);
  const {anchorNode, anchorOffset, isCollapsed} = domSelection;
  if (!anchorNode || !isCollapsed) {
    return;
  }

  // Chrome produces new text nodes in several scenarios.

  // 1) When typing at the beginning of a visual line, Chrome splits the text
  // nodes into two. Why? No one knows. This commit is suspicious:
  // https://chromium.googlesource.com/chromium/src/+/a3b600981286b135632371477f902214c55a1724

  // 2) When typing into a node which contains TAB character, it splits the leaf node cloning its attributes
  // and adds additional anonymous text node in between

  // Assume that the original content is <span data-text="true">Hello\tworld</span>

  // <span data-text="true">hello</span>X<span data-text="true">\tworld</span>
  // <span data-text="true">hello\t</span>X<span data-text="true">world</span>
  // <span data-text="true">hello\tworld</span>X

  // In both cases (and possibly more that may occur), we merge the sibling text nodes back into a consistent one.
  if (
    anchorNode.nodeType === Node.TEXT_NODE &&
    (anchorNode.previousSibling !== null || anchorNode.nextSibling !== null)
  ) {
    const span: ?Node = findAncestorWithOffsetKey(anchorNode);
    if (span == null || span.nodeName.toLowerCase() !== 'span') {
      return;
    }

    // Capture the original anchor offset relative to the parent
    let newAnchorOffset = anchorOffset;
    let currentNode = anchorNode;

    while (currentNode && currentNode !== span) {
      if (currentNode.previousSibling) {
        currentNode = currentNode.previousSibling;
        newAnchorOffset += currentNode.textContent.length;
      } else {
        currentNode = currentNode.parentNode;
      }
    }

    let unprocessedText: string = '';
    let resultTextNode: ?Node = null;

    // Reconcile the child nodes content into a single leaf node with data-text attribute
    // to make sure the DOM reflects structure supported by DraftJS
    // delete the other child nodes
    for (let i = span.childNodes.length - 1; i >= 0; i--) {
      const child = span.childNodes[i];
      if (!resultTextNode && child.hasAttribute?.('data-text')) {
        resultTextNode = child;
        if (unprocessedText) {
          child.textContent += unprocessedText;
          unprocessedText = '';
        }
      } else {
        if (resultTextNode) {
          resultTextNode.textContent =
            child.textContent + resultTextNode.textContent;
        } else {
          unprocessedText = child.textContent + unprocessedText;
        }
        span.removeChild(child);
      }
    }

    // Add a consistent text node in case none was left
    if (!resultTextNode && unprocessedText) {
      const missingTextNode = document.createElement('span');
      missingTextNode.setAttribute('data-text', 'true');
      missingTextNode.textContent = unprocessedText;
      span.appendChild(missingTextNode);
      resultTextNode = missingTextNode;
    }

    // Update the DOM selection
    domSelection.removeAllRanges();
    const newRange = document.createRange();
    newRange.setStart(
      resultTextNode.firstChild ?? resultTextNode,
      newAnchorOffset,
    );
    domSelection.addRange(newRange);
  }
}

function getDomSelection(editor: DraftEditor) {
  // at this point editor is not null for sure (after input)
  const castedEditorElement: HTMLElement = (editor.editor: any);
  const domSelection: SelectionObject = castedEditorElement.ownerDocument.defaultView.getSelection();

  return domSelection;
}

module.exports = editOnInput;
