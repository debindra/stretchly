# Stretchly Mobile (React Native)

**Planned.** This package will contain the React Native mobile app for Stretchly.

It will consume `@stretchly/shared` for types, exercises, and storage abstraction, and use AsyncStorage for persistence. UI will be built with React Native components (no Radix/Tailwind).

To add the app later:

1. Initialize React Native (Expo or CLI) in this directory.
2. Add `@stretchly/shared` as a dependency.
3. Implement a `StorageAdapter` using `@react-native-async-storage/async-storage`.
4. Build Dashboard, Library, Routine Player, Progress, and Settings screens with RN UI.
