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
const DraftOffsetKey = require('DraftOffsetKey');

const findAncestorOffsetKey = require('findAncestorOffsetKey');
const findAncestorWithOffsetKey = require('findAncestorWithOffsetKey');
const getOffsetKeyFromNode = require('getOffsetKeyFromNode');
const getWindowForNode = require('getWindowForNode');
const Immutable = require('immutable');
const invariant = require('invariant');

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
  mutations: Map<string, Node | null>;
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

  stopAndFlushMutations(): Map<string, Node | null> {
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

  addMutation(offsetKey: string, blockNode: Node | null): void {
    const {blockKey} = DraftOffsetKey.decode(offsetKey);
    this.mutations = this.mutations.set(blockKey, blockNode);
  }

  registerMutation(mutation: MutationRecordT): void {
    const {type, target, removedNodes, addedNodes} = mutation;

    // When multiple blocks are selected during the composition, some of them may get
    // completely overwritten (removed or added) in the process.
    // This always happens at the root of the editor where there are no more offset aware nodes up the hierarchy
    // otherwise all leaf node mutations must work with their ancestor offset key.
    const ancestorWithOffsetKey = findAncestorWithOffsetKey(target);
    if (ancestorWithOffsetKey == null) {
      if (type === 'childList') {
        // Removed blocks are marked with null in the mutations and get removed in resolveComposition
        if (removedNodes && removedNodes.length) {
          Array.from(removedNodes)
            .filter(node => node.hasAttribute?.('data-block'))
            .forEach(node => {
              const offsetKey = findAncestorOffsetKey(node);
              if (offsetKey) {
                this.addMutation(offsetKey, null);
              }
            });
        }

        // Some blocks may be reintroduced with undo during composition.
        // We register them for data reconstruction to overwrite the earlier removal recorded in the mutations.
        // Also, we don't know what else happened to the block in the meantime so reconstructing them is a safety guard.
        if (addedNodes && addedNodes.length) {
          Array.from(addedNodes)
            .filter(node => node.hasAttribute?.('data-block'))
            .forEach(node => {
              const offsetKey = findAncestorOffsetKey(node);
              if (offsetKey) {
                this.addMutation(offsetKey, node);
              }
            });
        }
      }
    } else {
      // Other mutations, typically around text nodes.
      // We record the offset key from the block root as in some cases (observed in Firefox),
      // the nodes with offset key from another block may get merged to the target block making the metadata inconsistent.
      // We let the reconstruction process in resolveComposition to handle that.
      const blockNode = findAncestorWithOffsetKey(ancestorWithOffsetKey, node =>
        node.hasAttribute('data-block'),
      );
      if (blockNode) {
        const offsetKey = getOffsetKeyFromNode(blockNode);
        if (offsetKey) {
          this.addMutation(offsetKey, blockNode);
        }
      }
    }
  }
}

module.exports = DOMObserver;
