import { registerDecorator, ValidationOptions } from 'class-validator';
import { MAX_MENTIONS, plainText } from './mentions';

/** What one stored mention adds beyond its "@Name": the brackets, the kind and the id. */
const MENTION_MARKUP = 50;

/**
 * A length limit on the words as readers see them.
 *
 * A mention is saved with the id of the person or company it names, which the
 * writer never sees and should not be charged for: "@Ada Lovelace" counts as
 * thirteen characters, as it does in the box they typed it in. The text as
 * sent is still capped, at the limit plus what the most mentions allowed can
 * carry, so the markup is no way around it.
 */
export function MaxReadableLength(max: number, options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'maxReadableLength',
      target: object.constructor,
      propertyName,
      constraints: [max],
      options: { message: `${propertyName} must be shorter than or equal to ${max} characters`, ...options },
      validator: {
        validate: (value: unknown) =>
          typeof value !== 'string' ||
          (value.length <= max + MAX_MENTIONS * MENTION_MARKUP && plainText(value).length <= max),
      },
    });
}
