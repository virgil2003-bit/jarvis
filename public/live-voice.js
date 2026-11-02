import { Conversation } from '@elevenlabs/client';
import { LiveVoiceController } from './live-controller.js';
export function createLiveVoice(options){return new LiveVoiceController({...options,connect:config=>Conversation.startSession(config)});}
