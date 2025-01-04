import { ParrisPreprocessor } from "./ParrisMessagePreprocessor";

export enum PreprocessorType {
    Parris = 'Parris',
    None = 'None',
}

export function getPreprocessor(type: PreprocessorType) {
    switch (type) {
        case PreprocessorType.Parris:
            return new ParrisPreprocessor()
        default:
            return undefined
    }
}