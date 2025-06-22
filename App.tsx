import React from 'react';
import { SafeAreaView, StatusBar } from 'react-native';
import { Main } from './sources/app/Main';

export default function App() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <StatusBar barStyle="dark-content" />
      <Main />
    </SafeAreaView>
  );
}