declare module 'mic' {
    import { Stream } from 'stream';

    interface MicOptions {
        rate?: string;
        channels?: string;
        debug?: boolean;
        exitOnSilence?: number;
        recordProgram?: string;
    }

    interface Mic {
        getAudioStream(): Stream;
        start(): void;
        stop(): void;
        pause(): void;
        resume(): void;
    }

    function mic(options?: MicOptions): Mic;

    export = mic;
}
