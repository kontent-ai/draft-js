import type UserSelection from 'UserSelection';

export type SelectionRange = {
  startOffset: number,
  endOffset: number,
  focusOffset: number | null,
  selection: UserSelection,
};
