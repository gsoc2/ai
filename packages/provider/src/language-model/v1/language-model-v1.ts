import { LanguageModelV1CallOptions } from './language-model-v1-call-options';
import { LanguageModelV1CallWarning } from './language-model-v1-call-warning';
import { LanguageModelV1FinishReason } from './language-model-v1-finish-reason';
import { LanguageModelV1FunctionToolCall } from './language-model-v1-function-tool-call';
import { LanguageModelV1LogProbs } from './language-model-v1-logprobs';
import { LanguageModelV1ProviderMetadata } from './language-model-v1-provider-metadata';

/**
Specification for a language model that implements the language model interface version 1.
 */
export type LanguageModelV1 = {
  /**
The language model must specify which language model interface
version it implements. This will allow us to evolve the language
model interface and retain backwards compatibility. The different
implementation versions can be handled as a discriminated union
on our side.
   */
  readonly specificationVersion: 'v1';

  /**
Name of the provider for logging purposes.
   */
  readonly provider: string;

  /**
Provider-specific model ID for logging purposes.
   */
  readonly modelId: string;

  /**
Default object generation mode that should be used with this model when
no mode is specified. Should be the mode with the best results for this
model. `undefined` can be returned if object generation is not supported.

This is needed to generate the best objects possible w/o requiring the
user to explicitly specify the object generation mode.
   */
  readonly defaultObjectGenerationMode: 'json' | 'tool' | undefined;

  /**
Flag whether this model supports image URLs. Default is `true`.

When the flag is set to `false`, the AI SDK will download the image and
pass the image data to the model.
   */
  readonly supportsImageUrls?: boolean;

  /**
Flag whether this model supports grammar-guided generation,
i.e. follows JSON schemas for object generation
when the response format is set to 'json' or
when the `object-json` mode is used.

This means that the model guarantees that the generated JSON
will be a valid JSON object AND that the object will match the
JSON schema.

Please note that `generateObject` and `streamObject` will work
regardless of this flag, but might send different prompts and
use further optimizations if this flag is set to `true`.

Defaults to `false`.

TODO rename to supportsGrammarGuidedGeneration in v2
*/
  readonly supportsStructuredOutputs?: boolean;

  /**
Generates a language model output (non-streaming).

Naming: "do" prefix to prevent accidental direct usage of the method
by the user.
   */
  doGenerate(options: LanguageModelV1CallOptions): PromiseLike<{
    /**
Text that the model has generated. Can be undefined if the model
has only generated tool calls.
     */
    text?: string;

    /**
Tool calls that the model has generated. Can be undefined if the
model has only generated text.
     */
    toolCalls?: Array<LanguageModelV1FunctionToolCall>;

    /**
Finish reason.
     */
    finishReason: LanguageModelV1FinishReason;

    /**
  Usage information.
     */
    usage: {
      promptTokens: number;
      completionTokens: number;
    };

    /**
Raw prompt and setting information for observability provider integration.
     */
    rawCall: {
      /**
Raw prompt after expansion and conversion to the format that the
provider uses to send the information to their API.
       */
      rawPrompt: unknown;

      /**
Raw settings that are used for the API call. Includes provider-specific
settings.
       */
      rawSettings: Record<string, unknown>;
    };

    /**
Optional raw response information for debugging purposes.
     */
    rawResponse?: {
      /**
Response headers.
      */
      headers?: Record<string, string>;
    };

    warnings?: LanguageModelV1CallWarning[];

    /**
Additional provider-specific metadata. They are passed through
from the provider to the AI SDK and enable provider-specific
results that can be fully encapsulated in the provider.
     */
    providerMetadata?: LanguageModelV1ProviderMetadata;

    /**
Logprobs for the completion.
`undefined` if the mode does not support logprobs or if was not enabled

@deprecated will be changed into a provider-specific extension in v2
     */
    logprobs?: LanguageModelV1LogProbs;
  }>;

  /**
Generates a language model output (streaming).

Naming: "do" prefix to prevent accidental direct usage of the method
by the user.
   *
@return A stream of higher-level language model output parts.
   */
  doStream(options: LanguageModelV1CallOptions): PromiseLike<{
    stream: ReadableStream<LanguageModelV1StreamPart>;

    /**
Raw prompt and setting information for observability provider integration.
     */
    rawCall: {
      /**
Raw prompt after expansion and conversion to the format that the
provider uses to send the information to their API.
       */
      rawPrompt: unknown;

      /**
Raw settings that are used for the API call. Includes provider-specific
settings.
       */
      rawSettings: Record<string, unknown>;
    };

    /**
Optional raw response data.
     */
    rawResponse?: {
      /**
Response headers.
       */
      headers?: Record<string, string>;
    };

    warnings?: LanguageModelV1CallWarning[];
  }>;
};

export type LanguageModelV1StreamPart =
  // Basic text deltas:
  | { type: 'text-delta'; textDelta: string }

  // Complete tool calls:
  | ({ type: 'tool-call' } & LanguageModelV1FunctionToolCall)

  // Tool call deltas are only needed for object generation modes.
  // The tool call deltas must be partial JSON strings.
  | {
      type: 'tool-call-delta';
      toolCallType: 'function';
      toolCallId: string;
      toolName: string;
      argsTextDelta: string;
    }

  // the usage stats, finish reason and logprobs should be the last part of the
  // stream:
  | {
      type: 'finish';
      finishReason: LanguageModelV1FinishReason;
      providerMetadata?: LanguageModelV1ProviderMetadata;
      usage: { promptTokens: number; completionTokens: number };

      // @deprecated - will be changed into a provider-specific extension in v2
      logprobs?: LanguageModelV1LogProbs;
    }

  // error parts are streamed, allowing for multiple errors
  | { type: 'error'; error: unknown };
