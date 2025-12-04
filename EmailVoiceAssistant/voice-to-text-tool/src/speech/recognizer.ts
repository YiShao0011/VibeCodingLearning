import * as sdk from 'microsoft-cognitiveservices-speech-sdk';
import { Readable } from 'stream';
import * as fs from 'fs';
import * as path from 'path';

const subscriptionKey = process.env.AZURE_SPEECH_KEY;
const region = process.env.AZURE_SPEECH_REGION || 'eastus';

if (!subscriptionKey) {
    throw new Error('AZURE_SPEECH_KEY environment variable is not set');
}

const speechConfig = sdk.SpeechConfig.fromSubscription(subscriptionKey, region);
speechConfig.speechRecognitionLanguage = 'en-US';

export async function transcribeFile(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const audioBuffer = fs.readFileSync(filePath);
        const audioConfig = sdk.AudioConfig.fromWavFileInput(audioBuffer);
        const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

        recognizer.recognizeOnceAsync((result) => {
            if (result.reason === sdk.ResultReason.RecognizedSpeech) {
                resolve(result.text);
            } else if (result.reason === sdk.ResultReason.NoMatch) {
                reject(new Error('Speech not recognized'));
            } else if (result.reason === sdk.ResultReason.Canceled) {
                const cancellation = sdk.CancellationDetails.fromResult(result);
                reject(new Error(`Error: ${cancellation.reason} - ${cancellation.errorDetails}`));
            }
            recognizer.close();
        });
    });
}

export async function transcribeStream(audioStream: Readable): Promise<string> {
    return new Promise((resolve, reject) => {
        // Create a temporary file to save the audio
        const tempFile = path.join(__dirname, '../../temp_audio.wav');
        const writeStream = fs.createWriteStream(tempFile);

        audioStream.pipe(writeStream);

        writeStream.on('finish', () => {
            // Add a small delay to ensure file is fully written
            setTimeout(() => {
                try {
                    // Read the file as buffer and transcribe
                    const audioBuffer = fs.readFileSync(tempFile);
                    
                    // Check if file is large enough to be valid
                    if (audioBuffer.length < 100) {
                        reject(new Error('Audio file too small - no speech detected'));
                        return;
                    }

                    const audioConfig = sdk.AudioConfig.fromWavFileInput(audioBuffer);
                    const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

                    recognizer.recognizeOnceAsync((result) => {
                        // Clean up temp file
                        fs.unlink(tempFile, (err) => {
                            if (err) console.error('Error deleting temp file:', err);
                        });

                        if (result.reason === sdk.ResultReason.RecognizedSpeech) {
                            resolve(result.text);
                        } else if (result.reason === sdk.ResultReason.NoMatch) {
                            reject(new Error('Speech not recognized'));
                        } else if (result.reason === sdk.ResultReason.Canceled) {
                            const cancellation = sdk.CancellationDetails.fromResult(result);
                            reject(new Error(`Error: ${cancellation.reason} - ${cancellation.errorDetails}`));
                        }
                        recognizer.close();
                    });
                } catch (err) {
                    reject(err);
                }
            }, 500); // 500ms delay
        });

        writeStream.on('error', (err) => {
            reject(err);
        });

        audioStream.on('error', (err) => {
            reject(err);
        });
    });
}