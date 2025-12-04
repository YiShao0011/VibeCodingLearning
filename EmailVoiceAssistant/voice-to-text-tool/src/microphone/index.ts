import mic from 'mic';
import { PassThrough } from 'stream';

export function getMicrophoneStream(): { stream: PassThrough; instance: any } {
    const micInstance = mic({
        rate: '16000',
        channels: '1',
        debug: false,
        exitOnSilence: 6
    });

    const audioStream = micInstance.getAudioStream();
    
    return { stream: audioStream, instance: micInstance };
}
class Microphone {
    private isListening: boolean;

    constructor() {
        this.isListening = false;
    }

    startListening(callback: (audioData: any) => void) {
        if (this.isListening) return;

        this.isListening = true;
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                const mediaRecorder = new MediaRecorder(stream);
                mediaRecorder.ondataavailable = event => {
                    callback(event.data);
                };
                mediaRecorder.start();
            })
            .catch(error => {
                console.error("Error accessing microphone:", error);
            });
    }

    stopListening() {
        this.isListening = false;
        // Logic to stop the microphone would go here
    }
}

export default Microphone;