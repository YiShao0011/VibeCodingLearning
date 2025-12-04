import { spawn } from 'child_process';
import { createWriteStream, statSync } from 'fs';
import { transcribeFile } from './speech/recognizer';
import { writeTextToFile } from './utils/fileWriter';
import { translateToChinese } from './utils/translator';

async function main() {
    console.log('Recording... Speak into your microphone.');
    console.log('Make sure AZURE_SPEECH_KEY and AZURE_SPEECH_REGION environment variables are set.');
    console.log('Recording will stop after 10 seconds.');
    
    const audioFilePath = 'audio.wav';
    const audioFile = createWriteStream(audioFilePath);

    // Use sox to record audio in WAV format for 10 seconds
    const recProcess = spawn('C:\\Program Files (x86)\\sox-14-4-2\\sox.exe', [
        '-t', 'waveaudio',  // Use Windows audio device
        '-d',              // Read from default input device
        '-t', 'wav',       // WAV format
        '-r', '16000',     // 16kHz sample rate
        '-b', '16',        // 16-bit
        '-c', '1',         // Mono (convert from stereo to mono)
        audioFilePath,     // Save to file
        'trim', '0', '10'  // Record for 10 seconds max
    ]);

    recProcess.on('close', async () => {
        try {
            console.log('Recording complete. Transcribing...');
            
            // Check file size
            const stats = statSync(audioFilePath);
            console.log(`Audio file size: ${stats.size} bytes`);
            
            if (stats.size < 100) {
                console.error('Audio file too small - no speech detected');
                return;
            }
            
            const transcript = await transcribeFile(audioFilePath);
            console.log('English Transcription:', transcript);
            
            // Try to translate to Chinese
            try {
                console.log('Translating to Chinese...');
                const chineseTranslation = await translateToChinese(transcript);
                console.log('Chinese Translation:', chineseTranslation);
                
                // Save both to file
                const outputContent = `English: ${transcript}\n\nChinese: ${chineseTranslation}`;
                writeTextToFile(outputContent, 'output.txt');
                console.log('Transcription and translation saved to output.txt');
            } catch (translationErr) {
                console.warn('Translation failed, saving English transcription only...');
                writeTextToFile(transcript, 'output.txt');
                console.log('English transcription saved to output.txt');
            }
        } catch (recognitionErr: any) {
            if (recognitionErr.message.includes('Speech not recognized')) {
                console.warn('⚠️ No speech detected in the audio.');
                console.warn('Tips:');
                console.warn('  - Speak clearly and loudly');
                console.warn('  - Reduce background noise');
                console.warn('  - Speak for at least 3-5 seconds');
                console.warn('  - Make sure your microphone is working');
                writeTextToFile('[No speech detected - please try again]', 'output.txt');
            } else {
                console.error('Error during transcription:', recognitionErr);
            }
        }
    });

    recProcess.stderr?.on('data', (data) => {
        console.error(`SoX error: ${data}`);
    });

    recProcess.on('error', (err) => {
        console.error('Error recording:', err);
    });
}

main();