import { MqttMessage } from "../../../../events";

export abstract class MessagePreprocessor {
    /**
     * Checks if the message can be processed by this preprocessor.
     * @param msg The MQTT message to check.
     * @returns True if the preprocessor can handle this message.
     */
    public abstract canPreprocess(msg: MqttMessage): boolean

    /**
     * Processes the given message and returns a transformed message.
     * @param msg The MQTT message to process.
     * @returns The processed MQTT message.
     */
    public abstract preprocess(msg: MqttMessage): MqttMessage | MqttMessage[]
}