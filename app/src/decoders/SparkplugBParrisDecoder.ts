import { Base64Message } from '../../../backend/src/Model/Base64Message'
import { Decoder } from '../../../backend/src/Model/Decoder'
import { get } from 'sparkplug-payload'
import { MessageDecoder } from './MessageDecoder'
var sparkplug = get('spBv1.0')

export const SparkplugBParrisDecoder: MessageDecoder = {
  formats: ['Sparkplug'],
  canDecodeTopic(topic: string) {
    return !!topic.match(/^spBv1\.0\/[^/]+\/[ND](DATA|CMD|DEATH|BIRTH)\/[^/]+(\/[^/]+)?$/u)
  },
  decode(input) {
    try {
      const decodedPayload = sparkplug!.decodePayload(new Uint8Array(input.toBuffer()))

      // Convert timestamp and seq fields to integers
      const reconstruct64Bit = (low: number, high: number) => {
        return low + high * Math.pow(2, 32)
      }

      if (decodedPayload.timestamp && typeof decodedPayload.timestamp === 'object') {
        decodedPayload.timestamp = reconstruct64Bit(
          decodedPayload.timestamp.low,
          decodedPayload.timestamp.high
        )
      }

      if (decodedPayload.seq && typeof decodedPayload.seq === 'object') {
        decodedPayload.seq = reconstruct64Bit(decodedPayload.seq.low, decodedPayload.seq.high)
      }

      // Wrap the decoded payload in Base64Message
      const message = Base64Message.fromString(JSON.stringify(decodedPayload))

      return { message, decoder: Decoder.SPARKPLUG }
    } catch (err) {
      console.error('Failed to decode Sparkplug payload:', err)
      return {
        error: 'Failed to decode Sparkplug payload',
        decoder: Decoder.NONE,
      }
    }
  },
};
