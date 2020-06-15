const Immutable = require('immutable');

const {OrderedSet} = Immutable;

function getEntityClassName(
  entityName: string,
  selectionUserIds: OrderedSet<string>,
  caretUserIds: OrderedSet<string>,
  customClassName: string | undefined,
): string | undefined {
  const classNames = [];

  if (customClassName) {
    classNames.push(customClassName);
  }

  if (selectionUserIds && !selectionUserIds.isEmpty()) {
    classNames.push(`${entityName}--has-selection`);
    selectionUserIds.forEach(userId =>
      classNames.push(`selection--user-${userId}`),
    );
  }

  if (caretUserIds && !caretUserIds.isEmpty()) {
    classNames.push(`${entityName}--has-caret`);
    caretUserIds.forEach(userId => classNames.push(`caret--user-${userId}`));
  }
  return classNames.length ? classNames.join(' ') : undefined;
}

module.exports = getEntityClassName;
