// EventTypes.ts - Sistema centralizado de eventos (CORREGIDO)

import { EventEmitter } from 'events';

// ==================== TIPOS DE EVENTOS ====================

export enum VideoProcessingEvent {
    // Lifecycle principal
    PROCESSING_STARTED = 'processing:started',
    PROCESSING_COMPLETED = 'processing:completed',
    PROCESSING_FAILED = 'processing:failed',
    
    // Fases principales
    PHASE_STARTED = 'phase:started',
    PHASE_PROGRESS = 'phase:progress',
    PHASE_COMPLETED = 'phase:completed',
    PHASE_FAILED = 'phase:failed',
    
    // Análisis
    ANALYSIS_STARTED = 'analysis:started',
    ANALYSIS_COMPLETED = 'analysis:completed',
    ANALYSIS_FAILED = 'analysis:failed',
    
    // Planificación
    PLANNING_STARTED = 'planning:started',
    PLANNING_COMPLETED = 'planning:completed',
    
    // Variantes de video
    VARIANT_STARTED = 'variant:started',
    VARIANT_PROGRESS = 'variant:progress',
    VARIANT_COMPLETED = 'variant:completed',
    VARIANT_FAILED = 'variant:failed',
    
    // Audio
    AUDIO_STARTED = 'audio:started',
    AUDIO_PROGRESS = 'audio:progress',
    AUDIO_COMPLETED = 'audio:completed',
    AUDIO_FAILED = 'audio:failed',
    
    // Subtítulos
    SUBTITLE_STARTED = 'subtitle:started',
    SUBTITLE_EXTRACTING = 'subtitle:extracting',
    SUBTITLE_EXTRACTED = 'subtitle:extracted',
    SUBTITLE_CONVERTING = 'subtitle:converting',
    SUBTITLE_COMPLETED = 'subtitle:completed',
    SUBTITLE_FAILED = 'subtitle:failed',
    
    // Playlists
    PLAYLIST_GENERATING = 'playlist:generating',
    PLAYLIST_COMPLETED = 'playlist:completed',
    
    // Sistema
    CLEANUP_STARTED = 'cleanup:started',
    CLEANUP_COMPLETED = 'cleanup:completed',
    
    // FFmpeg
    FFMPEG_COMMAND_START = 'ffmpeg:command:start',
    FFMPEG_PROGRESS = 'ffmpeg:progress',
    FFMPEG_COMMAND_END = 'ffmpeg:command:end',
    
    // Warnings y Info
    WARNING = 'warning',
    INFO = 'info'
}

// ==================== PAYLOADS TIPADOS ====================

export interface EventContext {
    processId: string;
    timestamp: Date;
    phase: ProcessingPhase;
}

export enum ProcessingPhase {
    ANALYZING = 'analyzing',
    PLANNING = 'planning',
    PROCESSING_VIDEO = 'processing-video',
    PROCESSING_AUDIO = 'processing-audio',
    PROCESSING_SUBTITLES = 'processing-subtitles',
    GENERATING_PLAYLISTS = 'generating-playlists',
    CLEANUP = 'cleanup',
    COMPLETE = 'complete'
}

export interface ProcessingStartedEvent extends EventContext {
    inputFile: string;
    config: any;
}

export interface PhaseProgressEvent extends EventContext {
    percent: number;
    message: string;
    details?: Record<string, any>;
}

export interface VariantStartedEvent extends EventContext {
    variantName: string;
    resolution: string;
    index: number;
    total: number;
}

export interface VariantProgressEvent extends EventContext {
    variantName: string;
    percent: number;
    fps?: number;
    speed?: string;
    bitrate?: string;
    timeProcessed?: string;
    eta?: string;
}

export interface VariantCompletedEvent extends EventContext {
    variantName: string;
    resolution: string;
    playlistPath: string;
    segmentCount: number;
    fileSize: number;
    duration: number;
}

export interface AudioProgressEvent extends EventContext {
    language: string;
    trackIndex: number;
    percent: number;
}

export interface SubtitleProgressEvent extends EventContext {
    language: string;
    action: 'detecting' | 'extracting' | 'converting' | 'generating-playlist';
    format?: string;
    percent?: number;
}

export interface FFmpegProgressEvent extends EventContext {
    commandId: string;
    taskType: 'video' | 'audio' | 'subtitle';
    taskName: string;
    percent: number;
    fps?: number;
    speed?: string;
    bitrate?: string;
    timeProcessed?: string;
    eta?: string;
}

export interface ProcessingCompletedEvent extends EventContext {
    videoId: string;
    totalDuration: number;
    variantsProcessed: number;
    audioTracksProcessed: number;
    subtitlesProcessed: number;
    totalSize: number;
    masterPlaylistPath: string;
}

export interface ProcessingFailedEvent extends EventContext {
    stage: string;
    error: Error;
    details?: Record<string, any>;
}

// ==================== MAPA DE EVENTOS (CON TIPOS EXACTOS) ====================

export type VideoProcessingEventMap = {
    [VideoProcessingEvent.PROCESSING_STARTED]: ProcessingStartedEvent;
    [VideoProcessingEvent.PROCESSING_COMPLETED]: ProcessingCompletedEvent;
    [VideoProcessingEvent.PROCESSING_FAILED]: ProcessingFailedEvent;
    
    [VideoProcessingEvent.PHASE_STARTED]: EventContext & { phase: ProcessingPhase };
    [VideoProcessingEvent.PHASE_PROGRESS]: PhaseProgressEvent;
    [VideoProcessingEvent.PHASE_COMPLETED]: EventContext & { phase: ProcessingPhase };
    [VideoProcessingEvent.PHASE_FAILED]: ProcessingFailedEvent;
    
    [VideoProcessingEvent.ANALYSIS_STARTED]: EventContext;
    [VideoProcessingEvent.ANALYSIS_COMPLETED]: EventContext & { metadata: any };
    [VideoProcessingEvent.ANALYSIS_FAILED]: ProcessingFailedEvent;
    
    [VideoProcessingEvent.PLANNING_STARTED]: EventContext;
    [VideoProcessingEvent.PLANNING_COMPLETED]: EventContext & { plan: any };
    
    [VideoProcessingEvent.VARIANT_STARTED]: VariantStartedEvent;
    [VideoProcessingEvent.VARIANT_PROGRESS]: VariantProgressEvent;
    [VideoProcessingEvent.VARIANT_COMPLETED]: VariantCompletedEvent;
    [VideoProcessingEvent.VARIANT_FAILED]: ProcessingFailedEvent;
    
    [VideoProcessingEvent.AUDIO_STARTED]: EventContext & { language: string };
    [VideoProcessingEvent.AUDIO_PROGRESS]: AudioProgressEvent;
    [VideoProcessingEvent.AUDIO_COMPLETED]: EventContext & { language: string };
    [VideoProcessingEvent.AUDIO_FAILED]: ProcessingFailedEvent;
    
    [VideoProcessingEvent.SUBTITLE_STARTED]: SubtitleProgressEvent;
    [VideoProcessingEvent.SUBTITLE_EXTRACTING]: SubtitleProgressEvent;
    [VideoProcessingEvent.SUBTITLE_EXTRACTED]: SubtitleProgressEvent;
    [VideoProcessingEvent.SUBTITLE_CONVERTING]: SubtitleProgressEvent;
    [VideoProcessingEvent.SUBTITLE_COMPLETED]: SubtitleProgressEvent;
    [VideoProcessingEvent.SUBTITLE_FAILED]: ProcessingFailedEvent;
    
    [VideoProcessingEvent.PLAYLIST_GENERATING]: EventContext & { type: string };
    [VideoProcessingEvent.PLAYLIST_COMPLETED]: EventContext & { type: string; path: string };
    
    [VideoProcessingEvent.CLEANUP_STARTED]: EventContext;
    [VideoProcessingEvent.CLEANUP_COMPLETED]: EventContext;
    
    [VideoProcessingEvent.FFMPEG_COMMAND_START]: FFmpegProgressEvent & { command: string };
    [VideoProcessingEvent.FFMPEG_PROGRESS]: FFmpegProgressEvent;
    [VideoProcessingEvent.FFMPEG_COMMAND_END]: FFmpegProgressEvent;
    
    [VideoProcessingEvent.WARNING]: EventContext & { message: string; details?: any };
    [VideoProcessingEvent.INFO]: EventContext & { message: string; details?: any };
};

// ==================== TYPED EVENT EMITTER (SOLUCIÓN AL ERROR) ====================

/**
 * EventEmitter tipado con type-safety completo
 * Usa Record para forzar el tipado exacto
 */
export class TypedVideoEventEmitter extends EventEmitter {
    /**
     * Emite un evento con su payload tipado
     */
    emit<K extends keyof VideoProcessingEventMap>(
        event: K,
        data: VideoProcessingEventMap[K]
    ): boolean {
        return super.emit(event as string, data);
    }

    /**
     * Suscribe a un evento con listener tipado
     */
    on<K extends keyof VideoProcessingEventMap>(
        event: K,
        listener: (data: VideoProcessingEventMap[K]) => void
    ): this {
        return super.on(event as string, listener);
    }

    /**
     * Suscribe a un evento una sola vez
     */
    once<K extends keyof VideoProcessingEventMap>(
        event: K,
        listener: (data: VideoProcessingEventMap[K]) => void
    ): this {
        return super.once(event as string, listener);
    }

    /**
     * Remueve un listener
     */
    off<K extends keyof VideoProcessingEventMap>(
        event: K,
        listener: (data: VideoProcessingEventMap[K]) => void
    ): this {
        return super.off(event as string, listener);
    }

    /**
     * Remueve todos los listeners de un evento
     */
    removeAllListeners<K extends keyof VideoProcessingEventMap>(event?: K): this {
        return super.removeAllListeners(event as string);
    }
}

// ==================== PROGRESS TRACKER ====================

export class ProcessingProgressTracker {
    private processId: string;
    private startTime: Date;
    private currentPhase: ProcessingPhase = ProcessingPhase.ANALYZING;
    private phaseProgress: Map<ProcessingPhase, number> = new Map();
    private variantProgress: Map<string, number> = new Map();
    
    private readonly phaseWeights: Record<ProcessingPhase, number> = {
        [ProcessingPhase.ANALYZING]: 5,
        [ProcessingPhase.PLANNING]: 5,
        [ProcessingPhase.PROCESSING_VIDEO]: 60,
        [ProcessingPhase.PROCESSING_AUDIO]: 15,
        [ProcessingPhase.PROCESSING_SUBTITLES]: 10,
        [ProcessingPhase.GENERATING_PLAYLISTS]: 3,
        [ProcessingPhase.CLEANUP]: 2,
        [ProcessingPhase.COMPLETE]: 0
    };

    constructor(processId: string) {
        this.processId = processId;
        this.startTime = new Date();
        
        for (const phase of Object.values(ProcessingPhase)) {
            this.phaseProgress.set(phase, 0);
        }
    }

    updatePhase(phase: ProcessingPhase, percent: number): void {
        this.currentPhase = phase;
        this.phaseProgress.set(phase, Math.min(100, Math.max(0, percent)));
    }

    updateVariant(variantName: string, percent: number): void {
        this.variantProgress.set(variantName, percent);
    }

    getGlobalProgress(): number {
        let totalProgress = 0;

        for (const [phase, weight] of Object.entries(this.phaseWeights)) {
            const phasePercent = this.phaseProgress.get(phase as ProcessingPhase) || 0;
            totalProgress += (phasePercent / 100) * weight;
        }

        return Math.min(100, Math.max(0, totalProgress));
    }

    getStatus(): {
        processId: string;
        phase: ProcessingPhase;
        globalPercent: number;
        phasePercent: number;
        elapsedSeconds: number;
        estimatedTotalSeconds: number;
        estimatedRemainingSeconds: number;
        variantsProgress: Record<string, number>;
    } {
        const globalPercent = this.getGlobalProgress();
        const phasePercent = this.phaseProgress.get(this.currentPhase) || 0;
        const elapsedSeconds = (Date.now() - this.startTime.getTime()) / 1000;
        const estimatedTotalSeconds = globalPercent > 0 
            ? (elapsedSeconds / globalPercent) * 100 
            : 0;
        const estimatedRemainingSeconds = estimatedTotalSeconds - elapsedSeconds;

        return {
            processId: this.processId,
            phase: this.currentPhase,
            globalPercent: Math.round(globalPercent * 100) / 100,
            phasePercent: Math.round(phasePercent * 100) / 100,
            elapsedSeconds: Math.round(elapsedSeconds),
            estimatedTotalSeconds: Math.round(estimatedTotalSeconds),
            estimatedRemainingSeconds: Math.round(Math.max(0, estimatedRemainingSeconds)),
            variantsProgress: Object.fromEntries(this.variantProgress)
        };
    }
}

// ==================== UTILIDAD: EVENT LOGGER ====================

/**
 * Logger de eventos para debugging
 */
export class EventLogger {
    constructor(private emitter: TypedVideoEventEmitter) {
        this.attachListeners();
    }

    private attachListeners(): void {
        // Lifecycle
        this.emitter.on(VideoProcessingEvent.PROCESSING_STARTED, (data) => {
            console.log(`🚀 [${data.processId}] Processing started: ${data.inputFile}`);
        });

        this.emitter.on(VideoProcessingEvent.PROCESSING_COMPLETED, (data) => {
            console.log(`✅ [${data.processId}] Processing completed in ${data.totalDuration}s`);
        });

        this.emitter.on(VideoProcessingEvent.PROCESSING_FAILED, (data) => {
            console.error(`❌ [${data.processId}] Processing failed at ${data.stage}:`, data.error.message);
        });

        // Phases
        this.emitter.on(VideoProcessingEvent.PHASE_STARTED, (data) => {
            console.log(`📍 [${data.processId}] Phase started: ${data.phase}`);
        });

        this.emitter.on(VideoProcessingEvent.PHASE_PROGRESS, (data) => {
            console.log(`⏳ [${data.processId}] ${data.phase}: ${data.percent}% - ${data.message}`);
        });

        // Variants
        this.emitter.on(VideoProcessingEvent.VARIANT_PROGRESS, (data) => {
            console.log(`🎬 [${data.processId}] ${data.variantName}: ${data.percent}% (${data.speed}, ETA: ${data.eta})`);
        });

        // Warnings
        this.emitter.on(VideoProcessingEvent.WARNING, (data) => {
            console.warn(`⚠️  [${data.processId}] ${data.message}`, data.details);
        });
    }
}