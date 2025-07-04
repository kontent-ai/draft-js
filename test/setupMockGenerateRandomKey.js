
jest.mock(
  '../src/model/keys/generateRandomKey.js',
  () => {
    let mockKeyCounter = 0;

    return () => `key${mockKeyCounter++}`
  }
);
