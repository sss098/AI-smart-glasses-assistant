import * as React from 'react';
import { SafeAreaView, StyleSheet, View } from 'react-native';
import { RoundButton } from './components/RoundButton';
import { Theme } from './components/theme';
import { useDevice } from '../modules/useDevice';
import { DeviceView } from './DeviceView';

export const Main = React.memo(() => {
    const [device, connectDevice] = useDevice();
    
    return (
        <SafeAreaView style={styles.container}>
            {!device && (
                <View style={styles.connectContainer}>
                    <RoundButton title="Connect to the device" action={connectDevice} />
                </View>
            )}
            {device && (
                <View style={styles.mainContainer}>
                    <DeviceView device={device} />
                </View>
            )}
        </SafeAreaView>
    );
});

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Theme.background,
        alignItems: 'stretch',
        justifyContent: 'center',
    },
    connectContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        alignSelf: 'center'
    },
    mainContainer: {
        flex: 1,
    }
});