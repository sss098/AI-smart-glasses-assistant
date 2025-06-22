declare module 'react-native-crypto-js' {
    namespace CryptoJS {
        interface WordArray {
            words: number[];
            sigBytes: number;
            toString(encoder?: any): string;
        }

        interface Cipher {
            ciphertext: WordArray;
            key: WordArray;
            iv: WordArray;
            salt: WordArray;
            algorithm: string;
            mode: string;
            padding: string;
            blockSize: number;
            formatter: any;
        }

        interface Hasher {
            update(messageUpdate: string | WordArray): Hasher;
            finalize(messageUpdate?: string | WordArray): WordArray;
        }

        interface HmacHasher {
            update(messageUpdate: string | WordArray): HmacHasher;
            finalize(messageUpdate?: string | WordArray): WordArray;
        }

        interface Encoder {
            stringify(wordArray: WordArray): string;
            parse(str: string): WordArray;
        }

        interface Utf8 {
            parse(str: string): WordArray;
            stringify(wordArray: WordArray): string;
        }

        interface Base64 {
            parse(str: string): WordArray;
            stringify(wordArray: WordArray): string;
        }

        interface enc {
            Utf8: Utf8;
            Base64: Base64;
        }

        function HmacSHA256(message: string | WordArray, key: string | WordArray): WordArray;
    }

    export = CryptoJS;
} 