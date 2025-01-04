import { Base64 } from 'js-base64'
import { TopicDataType } from './TreeNode'

export type Base64MessageDTO = Pick<Base64Message, 'base64Message'>

export class Base64Message {
  public base64Message: string
  private _unicodeValue: string | undefined

  // Todo: Rename to `encodedLength`
  public get length(): number {
    return this.base64Message.length
  }

  private get unicodeValue(): string {
    if (!this._unicodeValue) {
      const decodedStr = Base64.decode(this.base64Message ?? '')
      try {
        const asObject = JSON.parse(decodedStr)
        const fixed = Base64Message.fix64BitValues(asObject)
        this._unicodeValue = JSON.stringify(fixed)
      } catch (err) {
        this._unicodeValue = decodedStr
      }
    }

    return this._unicodeValue
  }

  constructor(base64Str?: string | Base64MessageDTO, error?: string) {
    if (typeof base64Str === 'string' || typeof base64Str === 'undefined') {
      this.base64Message = base64Str ?? ''
    } else {
      if (typeof base64Str.base64Message !== 'string') {
        throw new Error('Received unexpected type in copy constructor')
      }
      this.base64Message = base64Str.base64Message
    }
  }

  /**
   * Override default JSON serialization behavior to only return the DTO
   * @returns
   */
  public toJSON(): Base64MessageDTO {
    return { base64Message: this.base64Message }
  }

  public toUnicodeString() {
    return this.unicodeValue || ''
  }

  public static fromBuffer(buffer: Buffer) {
    return new Base64Message(buffer.toString('base64'))
  }

  public toBuffer(): Buffer {
    return Buffer.from(this.base64Message, 'base64')
  }

  public static fromString(str: string) {
    return new Base64Message(Base64.encode(str))
  }

  /**
   * Converts all properties with shape { low, high, unsigned } to a single integer.
   * This handles nested objects/arrays too, so if your metrics have their own
   * timestamp or seq fields, they will also be fixed.
   */
  private static fix64BitValues(obj: any): any {
    // If it's not an object or is null, nothing to fix
    if (typeof obj !== 'object' || obj === null) {
      return obj
    }

    // Check if it looks like a 64-bit representation
    if (
      typeof obj.low === 'number' &&
      typeof obj.high === 'number' &&
      typeof obj.unsigned === 'boolean'
    ) {
      // Reconstruct the 64-bit integer
      return obj.low + obj.high * Math.pow(2, 32)
    }

    // Otherwise, recurse into all properties (if it's an array, we'll iterate keys as well)
    for (const key of Object.keys(obj)) {
      obj[key] = Base64Message.fix64BitValues(obj[key])
    }

    return obj
  }

  /**
   * Formats the Base64-encoded payload into either a JSON string (and fixes 64-bit values),
   * hex, or a plain string. The second return value indicates if we want syntax highlighting.
   */
  public format(type: TopicDataType = 'string'): [string, 'json' | undefined] {
    try {
      switch (type) {
        case 'json': {
          // Parse the JSON
          const json = JSON.parse(this.toUnicodeString())

          // Recursively fix all 64-bit fields
          const fixed = Base64Message.fix64BitValues(json)

          // Return pretty-printed JSON
          return [JSON.stringify(fixed, null, 2), 'json']
        }
        case 'hex': {
          const hex = Base64Message.toHex(this)
          return [hex, undefined]
        }
        default: {
          const str = this.toUnicodeString()
          return [str, undefined]
        }
      }
    } catch (error) {
      // If JSON parse fails, just return the plain string
      const str = this.toUnicodeString()
      return [str, undefined]
    }
  }

  public static toHex(message: Base64Message) {
    const buf = Buffer.from(message.base64Message, 'base64')

    let str: string = ''
    buf.forEach(element => {
      let hex = element.toString(16).toUpperCase()
      str += `0x${hex.length < 2 ? '0' + hex : hex} `
    })
    return str.trimRight()
  }

  public static toDataUri(message: Base64Message, mimeType: string) {
    return `data:${mimeType};base64,${message.base64Message}`
  }
}
