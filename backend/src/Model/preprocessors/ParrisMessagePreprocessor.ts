import { MqttMessage } from '../../../../events'
import { Base64Message, Base64MessageDTO } from '../Base64Message';
import { MessagePreprocessor } from './MessagePreprocessor'

import { get } from 'sparkplug-payload'
var sparkplug = get('spBv1.0')

interface Payload {
    timestamp: number
    seq: number
    metrics: Array<{ name: string, dataType?: string, value?: any, [key: string]: any }>
}


export class ParrisPreprocessor extends MessagePreprocessor {
    private static readonly NODE_LEVEL_TOPIC_REGEX =
        /^spBv1\.0\/[^/]+\/N(DATA|CMD|DEATH|BIRTH)\/[^/]+$/;
    private static readonly DEVICE_LEVEL_TOPIC_REGEX =
        /^spBv1\.0\/[^/]+\/D(DATA|CMD|DEATH|BIRTH)\/[^/]+\/[^/]+$/;

    constructor() {
        super()
    }

    /**
     * Checks if the message topic matches the Parris method structure (Node or Device level).
     * @param msg The MQTT message to check.
     * @returns True if the topic matches the Parris method.
     */
    public canPreprocess(msg: MqttMessage): boolean {
        return (
            ParrisPreprocessor.NODE_LEVEL_TOPIC_REGEX.test(msg.topic) ||
            ParrisPreprocessor.DEVICE_LEVEL_TOPIC_REGEX.test(msg.topic)
        )
    }

    /**
     * Transforms a Parris-structured topic into Vanilla MQTT and adds metadata to the payload.
     * @param msg The MQTT message to process.
     * @returns The transformed MQTT message.
     */
    public preprocess(msg: MqttMessage): MqttMessage | MqttMessage[] {
        // Check for Node-level topic (e.g., NBIRTH, NDATA)
        console.log('preprocess', msg.topic)
        const metadata = {} as { messageType?: string, nodeId?: string, deviceId?: string };
        let topic = msg.topic;

        const nodeMatch = msg.topic.match(ParrisPreprocessor.NODE_LEVEL_TOPIC_REGEX)
        if (nodeMatch) {
            const [_, groupId, messageType, nodeId] = msg.topic.split('/')
            topic = [...groupId.split(':').filter(x => !!x)].join('/')
            metadata.messageType = messageType
            metadata.nodeId = nodeId
        }

        // Check for Device-level topic (e.g., DBIRTH, DDATA)
        const deviceMatch = msg.topic.match(ParrisPreprocessor.DEVICE_LEVEL_TOPIC_REGEX)
        if (deviceMatch) {
            const [_, groupId, messageType, nodeId, deviceId] = msg.topic.split('/')
            topic = [...groupId.split(':').filter(x => !!x)].join('/')
            metadata.messageType = messageType
            metadata.nodeId = nodeId
            metadata.deviceId = deviceId
        }


        if (msg.payload) {
            const decoded = this.decode(msg.payload)
            if ('message' in decoded) {
                const decodedPayload = JSON.parse(decoded.message.toUnicodeString()) as Payload;

                const messages = new Array<MqttMessage>()
                decodedPayload.metrics.forEach(metric => {
                    const customNamespace = [...metric.name.split(':').filter(x => !!x)].join('/')
                    const metricTopic = `${topic}/${customNamespace}`

                    const newMsg = {
                        ...msg,
                        topic: metricTopic,
                        payload: Base64Message.fromString(JSON.stringify(metric)),
                        metadata,
                    }
                    messages.push(newMsg)
                })

                return messages;
            }
            else {
                console.error(`Failed to decode Sparkplug payload: ${decoded.error}`)
                return {
                    ...msg,
                    topic,
                    payload: msg.payload,
                }
            }
        }
        else {
            return {
                ...msg,
                topic,
            }
        }
    }
    private decode(inputDTO: Base64MessageDTO): { message: Base64Message } | { error: string } {
        try {
            const input = new Base64Message(inputDTO)
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

            return { message }
        } catch (err) {
            console.error('Failed to decode Sparkplug payload:', err)
            return {
                error: 'Failed to decode Sparkplug payload',
            }
        }
    }
}
