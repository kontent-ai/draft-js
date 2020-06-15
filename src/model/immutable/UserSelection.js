'use strict';

const Immutable = require('immutable');

const {Record} = Immutable;

const defaultRecord: {
  anchorId: string,
  focusId: string,
  userId: string,
} = {
  anchorId: '',
  focusId: '',
  userId: '',
};

const UserSelectionRecord = (Record(defaultRecord): any);

class UserSelection extends UserSelectionRecord {
  static create(
    anchorId: string,
    focusId: string,
    userId: string,
  ): UserSelection {
    return new UserSelection({
      anchorId,
      focusId,
      userId,
    });
  }

  getAnchorId(): string {
    return this.get('anchorId');
  }

  getFocusId(): string {
    return this.get('focusId');
  }

  getUserId(): string {
    return this.get('userId');
  }

  getIsCollapsed(): boolean {
    return this.getAnchorId() === this.getFocusId();
  }
}

module.exports = UserSelection;
