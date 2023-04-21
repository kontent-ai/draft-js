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

const UserAgent = require('UserAgent');

const findAncestorOffsetKey = require('findAncestorOffsetKey');
const findAncestorWithOffsetKey = require('findAncestorWithOffsetKey');
const getOffsetKeyFromNode = require('getOffsetKeyFromNode');
const getWindowForNode = require('getWindowForNode');
const Immutable = require('immutable');
const invariant = require('invariant');
const nullthrows = require('nullthrows');

const {Map} = Immutable;

type MutationRecordT =
  | MutationRecord
  | {|type: 'characterData', target: Node, removedNodes?: void|};

// Heavily based on Prosemirror's DOMObserver https://github.com/ProseMirror/prosemirror-view/blob/master/src/domobserver.js

const DOM_OBSERVER_OPTIONS = {
  subtree: true,
  characterData: true,
  childList: true,
  characterDataOldValue: false,
  attributes: false,
};
// IE11 has very broken mutation observers, so we also listen to DOMCharacterDataModified
const USE_CHAR_DATA = UserAgent.isBrowser('IE <= 11');

class DOMObserver {
  observer: ?MutationObserver;
  container: HTMLElement;
  mutations: Map<string, string | null>;
  onCharData: ?({
    target: EventTarget,
    type: string,
    ...
  }) => void;

  constructor(container: HTMLElement) {
    this.container = container;
    this.mutations = Map();
    const containerWindow = getWindowForNode(container);
    if (containerWindow.MutationObserver && !USE_CHAR_DATA) {
      this.observer = new containerWindow.MutationObserver(mutations =>
        this.registerMutations(mutations),
      );
    } else {
      this.onCharData = e => {
        invariant(
          e.target instanceof Node,
          'Expected target to be an instance of Node',
        );
        this.registerMutation({
          type: 'characterData',
          target: e.target,
        });
      };
    }
  }

  start(): void {
    if (this.observer) {
      this.observer.observe(this.container, DOM_OBSERVER_OPTIONS);
    } else {
      /* $FlowFixMe[incompatible-call] (>=0.68.0 site=www,mobile) This event
       * type is not defined by Flow's standard library */
      this.container.addEventListener(
        'DOMCharacterDataModified',
        this.onCharData,
      );
    }
  }

  stopAndFlushMutations(): Map<string, string | null> {
    const {observer} = this;
    if (observer) {
      this.registerMutations(observer.takeRecords());
      observer.disconnect();
    } else {
      /* $FlowFixMe[incompatible-call] (>=0.68.0 site=www,mobile) This event
       * type is not defined by Flow's standard library */
      this.container.removeEventListener(
        'DOMCharacterDataModified',
        this.onCharData,
      );
    }
    const mutations = this.mutations;
    this.mutations = Map();
    return mutations;
  }

  registerMutations(mutations: Array<MutationRecord>): void {
    for (let i = 0; i < mutations.length; i++) {
      this.registerMutation(mutations[i]);
    }
  }

  addMutation(offsetKey: string, text: string | null): void {
    this.mutations = this.mutations.set(offsetKey, text);
  }

  registerMutation(mutation: MutationRecordT): void {
    const {type, target, removedNodes} = mutation;

    const ancestorWithOffsetKey = findAncestorWithOffsetKey(target);
    if (ancestorWithOffsetKey == null) {
      // When multiple blocks are selected during the composition, some of them may get completely overwritten (removed)
      // this always happens at the root of the editor where there are no more offset aware nodes up the hierarchy
      // otherwise all leaf node mutations must work with their ancestor offset key
      if (type === 'childList' && removedNodes && removedNodes.length) {
        Array.from(removedNodes)
          .filter(node => node.hasAttribute?.('data-block'))
          .forEach(node => {
            const offsetKey = findAncestorOffsetKey(node);
            if (offsetKey) {
              this.addMutation(offsetKey, null);
            }
          });
      }
    } else {
      const offsetKey = getOffsetKeyFromNode(ancestorWithOffsetKey);
      if (type === 'characterData') {
        // When `textContent` is '', there is a race condition that makes
        // getting the offsetKey from the target not possible.
        // These events are also followed by a `childList`, which is the one
        // we are able to retrieve the offsetKey and apply the '' text.
        if (target.textContent !== '') {
          // IE 11 considers the enter keypress that concludes the composition
          // as an input char. This strips that newline character so the draft
          // state does not receive spurious newlines.
          if (USE_CHAR_DATA) {
            this.addMutation(offsetKey, target.textContent.replace('\n', ''));
          } else {
            this.addMutation(offsetKey, target.textContent);
          }
        }
      } else if (type === 'childList') {
        if (removedNodes && removedNodes.length) {
          // When removed nodes are leaf nodes, it is a deletion of some inline formatted content
          // we need to register their respective mutations to make sure this content gets removed
          const removedLeafNodes = Array.from(removedNodes).filter(node =>
            node.hasAttribute?.('data-offset-key'),
          );
          if (removedLeafNodes.length) {
            removedLeafNodes.forEach(node =>
              this.addMutation(nullthrows(getOffsetKeyFromNode(node)), ''),
            );
          } else {
            // `characterData` events won't happen or are ignored when
            // removing the last character of a leaf node, what happens
            // instead is a `childList` event with a `removedNodes` array.
            // For this case the textContent should be '' and
            // `DraftModifier.replaceText` will make sure the content is
            // updated properly.
            this.addMutation(offsetKey, '');
          }
        } else if (target.textContent !== '') {
          // Typing Chinese in an empty block in MS Edge results in a
          // `childList` event with non-empty textContent.
          // See https://github.com/facebook/draft-js/issues/2082
          this.addMutation(offsetKey, target.textContent);
        }
      }
    }
  }
}

module.exports = DOMObserver;
