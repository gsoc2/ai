import { TypeValidationError } from '@ai-sdk/provider';
import {
  convertArrayToReadableStream,
  convertAsyncIterableToArray,
  convertReadableStreamToArray,
} from '@ai-sdk/provider-utils/test';
import { jsonSchema } from '@ai-sdk/ui-utils';
import assert from 'node:assert';
import { z } from 'zod';
import { setTestTracer } from '../telemetry/get-tracer';
import { MockLanguageModelV1 } from '../test/mock-language-model-v1';
import { createMockServerResponse } from '../test/mock-server-response';
import { MockTracer } from '../test/mock-tracer';
import { AsyncIterableStream } from '../util/async-iterable-stream';
import { streamObject } from './stream-object';
import { StreamObjectResult } from './stream-object-result';

describe('output = "object"', () => {
  describe('result.objectStream', () => {
    it('should send object deltas with json mode', async () => {
      const result = await streamObject({
        model: new MockLanguageModelV1({
          doStream: async ({ prompt, mode }) => {
            assert.deepStrictEqual(mode, {
              type: 'object-json',
              name: undefined,
              description: undefined,
              schema: {
                $schema: 'http://json-schema.org/draft-07/schema#',
                additionalProperties: false,
                properties: { content: { type: 'string' } },
                required: ['content'],
                type: 'object',
              },
            });

            assert.deepStrictEqual(prompt, [
              {
                role: 'system',
                content:
                  'JSON schema:\n' +
                  '{"type":"object","properties":{"content":{"type":"string"}},"required":["content"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}\n' +
                  'You MUST answer with a JSON object that matches the JSON schema above.',
              },
              { role: 'user', content: [{ type: 'text', text: 'prompt' }] },
            ]);

            return {
              stream: convertArrayToReadableStream([
                { type: 'text-delta', textDelta: '{ ' },
                { type: 'text-delta', textDelta: '"content": ' },
                { type: 'text-delta', textDelta: `"Hello, ` },
                { type: 'text-delta', textDelta: `world` },
                { type: 'text-delta', textDelta: `!"` },
                { type: 'text-delta', textDelta: ' }' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { completionTokens: 10, promptTokens: 3 },
                },
              ]),
              rawCall: { rawPrompt: 'prompt', rawSettings: {} },
            };
          },
        }),
        schema: z.object({ content: z.string() }),
        mode: 'json',
        prompt: 'prompt',
      });

      assert.deepStrictEqual(
        await convertAsyncIterableToArray(result.partialObjectStream),
        [
          {},
          { content: 'Hello, ' },
          { content: 'Hello, world' },
          { content: 'Hello, world!' },
        ],
      );
    });

    it('should send object deltas with json mode when structured outputs are enabled', async () => {
      const result = await streamObject({
        model: new MockLanguageModelV1({
          supportsStructuredOutputs: true,
          doStream: async ({ prompt, mode }) => {
            assert.deepStrictEqual(mode, {
              type: 'object-json',
              name: undefined,
              description: undefined,
              schema: {
                $schema: 'http://json-schema.org/draft-07/schema#',
                additionalProperties: false,
                properties: { content: { type: 'string' } },
                required: ['content'],
                type: 'object',
              },
            });

            assert.deepStrictEqual(prompt, [
              { role: 'user', content: [{ type: 'text', text: 'prompt' }] },
            ]);

            return {
              stream: convertArrayToReadableStream([
                { type: 'text-delta', textDelta: '{ ' },
                { type: 'text-delta', textDelta: '"content": ' },
                { type: 'text-delta', textDelta: `"Hello, ` },
                { type: 'text-delta', textDelta: `world` },
                { type: 'text-delta', textDelta: `!"` },
                { type: 'text-delta', textDelta: ' }' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { completionTokens: 10, promptTokens: 3 },
                },
              ]),
              rawCall: { rawPrompt: 'prompt', rawSettings: {} },
            };
          },
        }),
        schema: z.object({ content: z.string() }),
        mode: 'json',
        prompt: 'prompt',
      });

      assert.deepStrictEqual(
        await convertAsyncIterableToArray(result.partialObjectStream),
        [
          {},
          { content: 'Hello, ' },
          { content: 'Hello, world' },
          { content: 'Hello, world!' },
        ],
      );
    });

    it('should use name and description with json mode when structured outputs are enabled', async () => {
      const result = await streamObject({
        model: new MockLanguageModelV1({
          supportsStructuredOutputs: true,
          doStream: async ({ prompt, mode }) => {
            assert.deepStrictEqual(mode, {
              type: 'object-json',
              name: 'test-name',
              description: 'test description',
              schema: {
                $schema: 'http://json-schema.org/draft-07/schema#',
                additionalProperties: false,
                properties: { content: { type: 'string' } },
                required: ['content'],
                type: 'object',
              },
            });

            assert.deepStrictEqual(prompt, [
              { role: 'user', content: [{ type: 'text', text: 'prompt' }] },
            ]);

            return {
              stream: convertArrayToReadableStream([
                { type: 'text-delta', textDelta: '{ ' },
                { type: 'text-delta', textDelta: '"content": ' },
                { type: 'text-delta', textDelta: `"Hello, ` },
                { type: 'text-delta', textDelta: `world` },
                { type: 'text-delta', textDelta: `!"` },
                { type: 'text-delta', textDelta: ' }' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { completionTokens: 10, promptTokens: 3 },
                },
              ]),
              rawCall: { rawPrompt: 'prompt', rawSettings: {} },
            };
          },
        }),
        schema: z.object({ content: z.string() }),
        schemaName: 'test-name',
        schemaDescription: 'test description',
        mode: 'json',
        prompt: 'prompt',
      });

      assert.deepStrictEqual(
        await convertAsyncIterableToArray(result.partialObjectStream),
        [
          {},
          { content: 'Hello, ' },
          { content: 'Hello, world' },
          { content: 'Hello, world!' },
        ],
      );
    });

    it('should send object deltas with tool mode', async () => {
      const result = await streamObject({
        model: new MockLanguageModelV1({
          doStream: async ({ prompt, mode }) => {
            assert.deepStrictEqual(mode, {
              type: 'object-tool',
              tool: {
                type: 'function',
                name: 'json',
                description: 'Respond with a JSON object.',
                parameters: {
                  $schema: 'http://json-schema.org/draft-07/schema#',
                  additionalProperties: false,
                  properties: { content: { type: 'string' } },
                  required: ['content'],
                  type: 'object',
                },
              },
            });
            assert.deepStrictEqual(prompt, [
              { role: 'user', content: [{ type: 'text', text: 'prompt' }] },
            ]);

            return {
              stream: convertArrayToReadableStream([
                {
                  type: 'tool-call-delta',
                  toolCallType: 'function',
                  toolCallId: 'tool-call-1',
                  toolName: 'json',
                  argsTextDelta: '{ ',
                },
                {
                  type: 'tool-call-delta',
                  toolCallType: 'function',
                  toolCallId: 'tool-call-1',
                  toolName: 'json',
                  argsTextDelta: '"content": ',
                },
                {
                  type: 'tool-call-delta',
                  toolCallType: 'function',
                  toolCallId: 'tool-call-1',
                  toolName: 'json',
                  argsTextDelta: `"Hello, `,
                },
                {
                  type: 'tool-call-delta',
                  toolCallType: 'function',
                  toolCallId: 'tool-call-1',
                  toolName: 'json',
                  argsTextDelta: `world`,
                },
                {
                  type: 'tool-call-delta',
                  toolCallType: 'function',
                  toolCallId: 'tool-call-1',
                  toolName: 'json',
                  argsTextDelta: `!"`,
                },
                {
                  type: 'tool-call-delta',
                  toolCallType: 'function',
                  toolCallId: 'tool-call-1',
                  toolName: 'json',
                  argsTextDelta: ' }',
                },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { completionTokens: 10, promptTokens: 3 },
                },
              ]),
              rawCall: { rawPrompt: 'prompt', rawSettings: {} },
            };
          },
        }),
        schema: z.object({ content: z.string() }),
        mode: 'tool',
        prompt: 'prompt',
      });

      assert.deepStrictEqual(
        await convertAsyncIterableToArray(result.partialObjectStream),
        [
          {},
          { content: 'Hello, ' },
          { content: 'Hello, world' },
          { content: 'Hello, world!' },
        ],
      );
    });

    it('should  use name and description with tool mode', async () => {
      const result = await streamObject({
        model: new MockLanguageModelV1({
          doStream: async ({ prompt, mode }) => {
            assert.deepStrictEqual(mode, {
              type: 'object-tool',
              tool: {
                type: 'function',
                name: 'test-name',
                description: 'test description',
                parameters: {
                  $schema: 'http://json-schema.org/draft-07/schema#',
                  additionalProperties: false,
                  properties: { content: { type: 'string' } },
                  required: ['content'],
                  type: 'object',
                },
              },
            });
            assert.deepStrictEqual(prompt, [
              { role: 'user', content: [{ type: 'text', text: 'prompt' }] },
            ]);

            return {
              stream: convertArrayToReadableStream([
                {
                  type: 'tool-call-delta',
                  toolCallType: 'function',
                  toolCallId: 'tool-call-1',
                  toolName: 'json',
                  argsTextDelta: '{ ',
                },
                {
                  type: 'tool-call-delta',
                  toolCallType: 'function',
                  toolCallId: 'tool-call-1',
                  toolName: 'json',
                  argsTextDelta: '"content": ',
                },
                {
                  type: 'tool-call-delta',
                  toolCallType: 'function',
                  toolCallId: 'tool-call-1',
                  toolName: 'json',
                  argsTextDelta: `"Hello, `,
                },
                {
                  type: 'tool-call-delta',
                  toolCallType: 'function',
                  toolCallId: 'tool-call-1',
                  toolName: 'json',
                  argsTextDelta: `world`,
                },
                {
                  type: 'tool-call-delta',
                  toolCallType: 'function',
                  toolCallId: 'tool-call-1',
                  toolName: 'json',
                  argsTextDelta: `!"`,
                },
                {
                  type: 'tool-call-delta',
                  toolCallType: 'function',
                  toolCallId: 'tool-call-1',
                  toolName: 'json',
                  argsTextDelta: ' }',
                },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { completionTokens: 10, promptTokens: 3 },
                },
              ]),
              rawCall: { rawPrompt: 'prompt', rawSettings: {} },
            };
          },
        }),
        schema: z.object({ content: z.string() }),
        schemaName: 'test-name',
        schemaDescription: 'test description',
        mode: 'tool',
        prompt: 'prompt',
      });

      assert.deepStrictEqual(
        await convertAsyncIterableToArray(result.partialObjectStream),
        [
          {},
          { content: 'Hello, ' },
          { content: 'Hello, world' },
          { content: 'Hello, world!' },
        ],
      );
    });
  });

  describe('result.fullStream', () => {
    it('should send full stream data', async () => {
      const result = await streamObject({
        model: new MockLanguageModelV1({
          doStream: async () => ({
            stream: convertArrayToReadableStream([
              { type: 'text-delta', textDelta: '{ ' },
              { type: 'text-delta', textDelta: '"content": ' },
              { type: 'text-delta', textDelta: `"Hello, ` },
              { type: 'text-delta', textDelta: `world` },
              { type: 'text-delta', textDelta: `!"` },
              { type: 'text-delta', textDelta: ' }' },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { completionTokens: 10, promptTokens: 2 },
                logprobs: [{ token: '-', logprob: 1, topLogprobs: [] }],
              },
            ]),
            rawCall: { rawPrompt: 'prompt', rawSettings: { logprobs: 0 } },
          }),
        }),
        schema: z.object({ content: z.string() }),
        mode: 'json',
        prompt: 'prompt',
      });

      assert.deepStrictEqual(
        await convertAsyncIterableToArray(result.fullStream),
        [
          {
            type: 'object',
            object: {},
          },
          {
            type: 'text-delta',
            textDelta: '{ ',
          },
          {
            type: 'object',
            object: { content: 'Hello, ' },
          },
          {
            type: 'text-delta',
            textDelta: '"content": "Hello, ',
          },
          {
            type: 'object',
            object: { content: 'Hello, world' },
          },
          {
            type: 'text-delta',
            textDelta: 'world',
          },
          {
            type: 'object',
            object: { content: 'Hello, world!' },
          },
          {
            type: 'text-delta',
            textDelta: '!"',
          },
          {
            type: 'text-delta',
            textDelta: ' }',
          },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { promptTokens: 2, completionTokens: 10, totalTokens: 12 },
            logprobs: [
              {
                token: '-',
                logprob: 1,
                topLogprobs: [],
              },
            ],
          },
        ],
      );
    });
  });

  describe('result.textStream', () => {
    it('should send text stream', async () => {
      const result = await streamObject({
        model: new MockLanguageModelV1({
          doStream: async () => ({
            stream: convertArrayToReadableStream([
              { type: 'text-delta', textDelta: '{ ' },
              { type: 'text-delta', textDelta: '"content": ' },
              { type: 'text-delta', textDelta: `"Hello, ` },
              { type: 'text-delta', textDelta: `world` },
              { type: 'text-delta', textDelta: `!"` },
              { type: 'text-delta', textDelta: ' }' },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { completionTokens: 10, promptTokens: 2 },
              },
            ]),
            rawCall: { rawPrompt: 'prompt', rawSettings: {} },
          }),
        }),
        schema: z.object({ content: z.string() }),
        mode: 'json',
        prompt: 'prompt',
      });

      assert.deepStrictEqual(
        await convertAsyncIterableToArray(result.textStream),
        ['{ ', '"content": "Hello, ', 'world', '!"', ' }'],
      );
    });
  });

  describe('result.toTextStreamResponse', () => {
    it('should create a Response with a text stream', async () => {
      const result = await streamObject({
        model: new MockLanguageModelV1({
          doStream: async () => ({
            stream: convertArrayToReadableStream([
              { type: 'text-delta', textDelta: '{ ' },
              { type: 'text-delta', textDelta: '"content": ' },
              { type: 'text-delta', textDelta: `"Hello, ` },
              { type: 'text-delta', textDelta: `world` },
              { type: 'text-delta', textDelta: `!"` },
              { type: 'text-delta', textDelta: ' }' },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { completionTokens: 10, promptTokens: 2 },
              },
            ]),
            rawCall: { rawPrompt: 'prompt', rawSettings: {} },
          }),
        }),
        schema: z.object({ content: z.string() }),
        mode: 'json',
        prompt: 'prompt',
      });

      const response = result.toTextStreamResponse();

      assert.strictEqual(response.status, 200);
      assert.strictEqual(
        response.headers.get('Content-Type'),
        'text/plain; charset=utf-8',
      );

      assert.deepStrictEqual(
        await convertReadableStreamToArray(
          response.body!.pipeThrough(new TextDecoderStream()),
        ),
        ['{ ', '"content": "Hello, ', 'world', '!"', ' }'],
      );
    });
  });

  describe('result.pipeTextStreamToResponse', async () => {
    it('should write text deltas to a Node.js response-like object', async () => {
      const mockResponse = createMockServerResponse();

      const result = await streamObject({
        model: new MockLanguageModelV1({
          doStream: async () => ({
            stream: convertArrayToReadableStream([
              { type: 'text-delta', textDelta: '{ ' },
              { type: 'text-delta', textDelta: '"content": ' },
              { type: 'text-delta', textDelta: `"Hello, ` },
              { type: 'text-delta', textDelta: `world` },
              { type: 'text-delta', textDelta: `!"` },
              { type: 'text-delta', textDelta: ' }' },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { completionTokens: 10, promptTokens: 2 },
              },
            ]),
            rawCall: { rawPrompt: 'prompt', rawSettings: {} },
          }),
        }),
        schema: z.object({ content: z.string() }),
        mode: 'json',
        prompt: 'prompt',
      });

      result.pipeTextStreamToResponse(mockResponse);

      // Wait for the stream to finish writing to the mock response
      await new Promise(resolve => {
        const checkIfEnded = () => {
          if (mockResponse.ended) {
            resolve(undefined);
          } else {
            setImmediate(checkIfEnded);
          }
        };
        checkIfEnded();
      });

      const decoder = new TextDecoder();

      assert.strictEqual(mockResponse.statusCode, 200);
      assert.deepStrictEqual(mockResponse.headers, {
        'Content-Type': 'text/plain; charset=utf-8',
      });
      assert.deepStrictEqual(
        mockResponse.writtenChunks.map(chunk => decoder.decode(chunk)),
        ['{ ', '"content": "Hello, ', 'world', '!"', ' }'],
      );
    });
  });

  describe('result.usage', () => {
    it('should resolve with token usage', async () => {
      const result = await streamObject({
        model: new MockLanguageModelV1({
          doStream: async () => ({
            stream: convertArrayToReadableStream([
              {
                type: 'text-delta',
                textDelta: '{ "content": "Hello, world!" }',
              },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { completionTokens: 10, promptTokens: 3 },
              },
            ]),
            rawCall: { rawPrompt: 'prompt', rawSettings: {} },
          }),
        }),
        schema: z.object({ content: z.string() }),
        mode: 'json',
        prompt: 'prompt',
      });

      // consume stream (runs in parallel)
      convertAsyncIterableToArray(result.partialObjectStream);

      assert.deepStrictEqual(await result.usage, {
        completionTokens: 10,
        promptTokens: 3,
        totalTokens: 13,
      });
    });
  });

  describe('result.providerMetadata', () => {
    it('should resolve with provider metadata', async () => {
      const result = await streamObject({
        model: new MockLanguageModelV1({
          doStream: async () => ({
            stream: convertArrayToReadableStream([
              {
                type: 'text-delta',
                textDelta: '{ "content": "Hello, world!" }',
              },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { completionTokens: 10, promptTokens: 3 },
                providerMetadata: {
                  testProvider: { testKey: 'testValue' },
                },
              },
            ]),
            rawCall: { rawPrompt: 'prompt', rawSettings: {} },
          }),
        }),
        schema: z.object({ content: z.string() }),
        mode: 'json',
        prompt: 'prompt',
      });

      // consume stream (runs in parallel)
      convertAsyncIterableToArray(result.partialObjectStream);

      assert.deepStrictEqual(await result.experimental_providerMetadata, {
        testProvider: { testKey: 'testValue' },
      });
    });
  });

  describe('result.object', () => {
    it('should resolve with typed object', async () => {
      const result = await streamObject({
        model: new MockLanguageModelV1({
          doStream: async () => ({
            stream: convertArrayToReadableStream([
              { type: 'text-delta', textDelta: '{ ' },
              { type: 'text-delta', textDelta: '"content": ' },
              { type: 'text-delta', textDelta: `"Hello, ` },
              { type: 'text-delta', textDelta: `world` },
              { type: 'text-delta', textDelta: `!"` },
              { type: 'text-delta', textDelta: ' }' },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { completionTokens: 10, promptTokens: 3 },
              },
            ]),
            rawCall: { rawPrompt: 'prompt', rawSettings: {} },
          }),
        }),
        schema: z.object({ content: z.string() }),
        mode: 'json',
        prompt: 'prompt',
      });

      // consume stream (runs in parallel)
      convertAsyncIterableToArray(result.partialObjectStream);

      assert.deepStrictEqual(await result.object, {
        content: 'Hello, world!',
      });
    });

    it('should reject object promise when the streamed object does not match the schema', async () => {
      const result = await streamObject({
        model: new MockLanguageModelV1({
          doStream: async () => ({
            stream: convertArrayToReadableStream([
              { type: 'text-delta', textDelta: '{ ' },
              { type: 'text-delta', textDelta: '"invalid": ' },
              { type: 'text-delta', textDelta: `"Hello, ` },
              { type: 'text-delta', textDelta: `world` },
              { type: 'text-delta', textDelta: `!"` },
              { type: 'text-delta', textDelta: ' }' },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { completionTokens: 10, promptTokens: 3 },
              },
            ]),
            rawCall: { rawPrompt: 'prompt', rawSettings: {} },
          }),
        }),
        schema: z.object({ content: z.string() }),
        mode: 'json',
        prompt: 'prompt',
      });

      // consume stream (runs in parallel)
      convertAsyncIterableToArray(result.partialObjectStream);

      await result.object
        .then(() => {
          assert.fail('Expected object promise to be rejected');
        })
        .catch(error => {
          expect(TypeValidationError.isTypeValidationError(error)).toBeTruthy();
        });
    });

    it('should not lead to unhandled promise rejections when the streamed object does not match the schema', async () => {
      const result = await streamObject({
        model: new MockLanguageModelV1({
          doStream: async () => ({
            stream: convertArrayToReadableStream([
              { type: 'text-delta', textDelta: '{ ' },
              { type: 'text-delta', textDelta: '"invalid": ' },
              { type: 'text-delta', textDelta: `"Hello, ` },
              { type: 'text-delta', textDelta: `world` },
              { type: 'text-delta', textDelta: `!"` },
              { type: 'text-delta', textDelta: ' }' },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { completionTokens: 10, promptTokens: 3 },
              },
            ]),
            rawCall: { rawPrompt: 'prompt', rawSettings: {} },
          }),
        }),
        schema: z.object({ content: z.string() }),
        mode: 'json',
        prompt: 'prompt',
      });

      // consume stream (runs in parallel)
      convertAsyncIterableToArray(result.partialObjectStream);

      // unhandled promise rejection should not be thrown (Vitest does this automatically)
    });
  });

  describe('options.onFinish', () => {
    describe('with successfully validated object', () => {
      let result: Parameters<
        Required<Parameters<typeof streamObject>[0]>['onFinish']
      >[0];

      beforeEach(async () => {
        const { partialObjectStream } = await streamObject({
          model: new MockLanguageModelV1({
            doStream: async () => ({
              stream: convertArrayToReadableStream([
                {
                  type: 'text-delta',
                  textDelta: '{ "content": "Hello, world!" }',
                },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { completionTokens: 10, promptTokens: 3 },
                  providerMetadata: {
                    testProvider: { testKey: 'testValue' },
                  },
                },
              ]),
              rawCall: { rawPrompt: 'prompt', rawSettings: {} },
            }),
          }),
          schema: z.object({ content: z.string() }),
          mode: 'json',
          prompt: 'prompt',
          onFinish: async event => {
            result = event as unknown as typeof result;
          },
        });

        // consume stream
        await convertAsyncIterableToArray(partialObjectStream);
      });

      it('should contain token usage', async () => {
        assert.deepStrictEqual(result.usage, {
          completionTokens: 10,
          promptTokens: 3,
          totalTokens: 13,
        });
      });

      it('should contain the full object', async () => {
        assert.deepStrictEqual(result.object, {
          content: 'Hello, world!',
        });
      });

      it('should not contain an error object', async () => {
        assert.deepStrictEqual(result.error, undefined);
      });

      it('should contain provider metadata', async () => {
        assert.deepStrictEqual(result.experimental_providerMetadata, {
          testProvider: { testKey: 'testValue' },
        });
      });
    });

    describe("with object that doesn't match the schema", () => {
      let result: Parameters<
        Required<Parameters<typeof streamObject>[0]>['onFinish']
      >[0];

      beforeEach(async () => {
        const { partialObjectStream, object } = await streamObject({
          model: new MockLanguageModelV1({
            doStream: async () => ({
              stream: convertArrayToReadableStream([
                { type: 'text-delta', textDelta: '{ ' },
                { type: 'text-delta', textDelta: '"invalid": ' },
                { type: 'text-delta', textDelta: `"Hello, ` },
                { type: 'text-delta', textDelta: `world` },
                { type: 'text-delta', textDelta: `!"` },
                { type: 'text-delta', textDelta: ' }' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { completionTokens: 10, promptTokens: 3 },
                },
              ]),
              rawCall: { rawPrompt: 'prompt', rawSettings: {} },
            }),
          }),
          schema: z.object({ content: z.string() }),
          mode: 'json',
          prompt: 'prompt',
          onFinish: async event => {
            result = event as unknown as typeof result;
          },
        });

        // consume stream
        await convertAsyncIterableToArray(partialObjectStream);

        // consume expected error rejection
        await object.catch(() => {});
      });

      it('should contain token usage', async () => {
        assert.deepStrictEqual(result.usage, {
          completionTokens: 10,
          promptTokens: 3,
          totalTokens: 13,
        });
      });

      it('should not contain a full object', async () => {
        assert.deepStrictEqual(result.object, undefined);
      });

      it('should contain an error object', async () => {
        assert.deepStrictEqual(
          TypeValidationError.isInstance(result.error),
          true,
        );
      });
    });
  });

  describe('options.headers', () => {
    it('should set headers', async () => {
      const result = await streamObject({
        model: new MockLanguageModelV1({
          doStream: async ({ headers }) => {
            assert.deepStrictEqual(headers, {
              'custom-request-header': 'request-header-value',
            });

            return {
              stream: convertArrayToReadableStream([
                { type: 'text-delta', textDelta: '{ ' },
                { type: 'text-delta', textDelta: '"content": ' },
                { type: 'text-delta', textDelta: `"Hello, ` },
                { type: 'text-delta', textDelta: `world` },
                { type: 'text-delta', textDelta: `!"` },
                { type: 'text-delta', textDelta: ' }' },
              ]),
              rawCall: { rawPrompt: 'prompt', rawSettings: {} },
            };
          },
        }),
        schema: z.object({ content: z.string() }),
        mode: 'json',
        prompt: 'prompt',
        headers: { 'custom-request-header': 'request-header-value' },
      });

      assert.deepStrictEqual(
        await convertAsyncIterableToArray(result.partialObjectStream),
        [
          {},
          { content: 'Hello, ' },
          { content: 'Hello, world' },
          { content: 'Hello, world!' },
        ],
      );
    });
  });

  describe('custom schema', () => {
    it('should send object deltas with json mode', async () => {
      const result = await streamObject({
        model: new MockLanguageModelV1({
          doStream: async ({ prompt, mode }) => {
            assert.deepStrictEqual(mode, {
              type: 'object-json',
              name: undefined,
              description: undefined,
              schema: jsonSchema({
                type: 'object',
                properties: { content: { type: 'string' } },
                required: ['content'],
                additionalProperties: false,
              }).jsonSchema,
            });

            assert.deepStrictEqual(prompt, [
              {
                role: 'system',
                content:
                  'JSON schema:\n' +
                  '{"type":"object","properties":{"content":{"type":"string"}},"required":["content"],"additionalProperties":false}\n' +
                  'You MUST answer with a JSON object that matches the JSON schema above.',
              },
              { role: 'user', content: [{ type: 'text', text: 'prompt' }] },
            ]);

            return {
              stream: convertArrayToReadableStream([
                { type: 'text-delta', textDelta: '{ ' },
                { type: 'text-delta', textDelta: '"content": ' },
                { type: 'text-delta', textDelta: `"Hello, ` },
                { type: 'text-delta', textDelta: `world` },
                { type: 'text-delta', textDelta: `!"` },
                { type: 'text-delta', textDelta: ' }' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { completionTokens: 10, promptTokens: 3 },
                },
              ]),
              rawCall: { rawPrompt: 'prompt', rawSettings: {} },
            };
          },
        }),
        schema: jsonSchema({
          type: 'object',
          properties: { content: { type: 'string' } },
          required: ['content'],
          additionalProperties: false,
        }),
        mode: 'json',
        prompt: 'prompt',
      });

      assert.deepStrictEqual(
        await convertAsyncIterableToArray(result.partialObjectStream),
        [
          {},
          { content: 'Hello, ' },
          { content: 'Hello, world' },
          { content: 'Hello, world!' },
        ],
      );
    });
  });
});

describe('output = "array"', () => {
  describe('array with 3 elements', () => {
    let result: StreamObjectResult<
      { content: string }[],
      { content: string }[],
      AsyncIterableStream<{ content: string }>
    >;

    let onFinishResult: Parameters<
      Required<Parameters<typeof streamObject>[0]>['onFinish']
    >[0];

    beforeEach(async () => {
      result = await streamObject({
        model: new MockLanguageModelV1({
          doStream: async ({ prompt, mode }) => {
            assert.deepStrictEqual(mode, {
              type: 'object-json',
              name: undefined,
              description: undefined,
              schema: {
                $schema: 'http://json-schema.org/draft-07/schema#',
                additionalProperties: false,
                properties: {
                  elements: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: { content: { type: 'string' } },
                      required: ['content'],
                      additionalProperties: false,
                    },
                  },
                },
                required: ['elements'],
                type: 'object',
              },
            });

            assert.deepStrictEqual(prompt, [
              {
                role: 'system',
                content:
                  'JSON schema:\n' +
                  `{\"$schema\":\"http://json-schema.org/draft-07/schema#\",\"type\":\"object\",\"properties\":{\"elements\":{\"type\":\"array\",\"items\":{\"type\":\"object\",\"properties\":{\"content\":{\"type\":\"string\"}},\"required\":[\"content\"],\"additionalProperties\":false}}},\"required\":[\"elements\"],\"additionalProperties\":false}` +
                  `\n` +
                  'You MUST answer with a JSON object that matches the JSON schema above.',
              },
              { role: 'user', content: [{ type: 'text', text: 'prompt' }] },
            ]);

            return {
              stream: convertArrayToReadableStream([
                { type: 'text-delta', textDelta: '{"elements":[' },
                // first element:
                { type: 'text-delta', textDelta: '{' },
                { type: 'text-delta', textDelta: '"content":' },
                { type: 'text-delta', textDelta: `"element 1"` },
                { type: 'text-delta', textDelta: '},' },
                // second element:
                { type: 'text-delta', textDelta: '{ ' },
                { type: 'text-delta', textDelta: '"content": ' },
                { type: 'text-delta', textDelta: `"element 2"` },
                { type: 'text-delta', textDelta: '},' },
                // third element:
                { type: 'text-delta', textDelta: '{' },
                { type: 'text-delta', textDelta: '"content":' },
                { type: 'text-delta', textDelta: `"element 3"` },
                { type: 'text-delta', textDelta: '}' },
                // end of array
                { type: 'text-delta', textDelta: ']' },
                { type: 'text-delta', textDelta: '}' },
                // finish
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { completionTokens: 10, promptTokens: 3 },
                },
              ]),
              rawCall: { rawPrompt: 'prompt', rawSettings: {} },
            };
          },
        }),
        schema: z.object({ content: z.string() }),
        output: 'array',
        mode: 'json',
        prompt: 'prompt',
        onFinish: async event => {
          onFinishResult = event as unknown as typeof onFinishResult;
        },
      });
    });

    it('should stream only complete objects in partialObjectStream', async () => {
      assert.deepStrictEqual(
        await convertAsyncIterableToArray(result.partialObjectStream),
        [
          [],
          [{ content: 'element 1' }],
          [{ content: 'element 1' }, { content: 'element 2' }],
          [
            { content: 'element 1' },
            { content: 'element 2' },
            { content: 'element 3' },
          ],
        ],
      );
    });

    it('should stream only complete objects in textStream', async () => {
      assert.deepStrictEqual(
        await convertAsyncIterableToArray(result.textStream),
        [
          '[',
          '{"content":"element 1"}',
          ',{"content":"element 2"}',
          ',{"content":"element 3"}]',
        ],
      );
    });

    it('should have the correct object result', async () => {
      // consume stream
      await convertAsyncIterableToArray(result.partialObjectStream);

      expect(await result.object).toStrictEqual([
        { content: 'element 1' },
        { content: 'element 2' },
        { content: 'element 3' },
      ]);
    });

    it('should call onFinish callback with full array', async () => {
      expect(onFinishResult.object).toStrictEqual([
        { content: 'element 1' },
        { content: 'element 2' },
        { content: 'element 3' },
      ]);
    });

    it('should stream elements individually in elementStream', async () => {
      assert.deepStrictEqual(
        await convertAsyncIterableToArray(result.elementStream),
        [
          { content: 'element 1' },
          { content: 'element 2' },
          { content: 'element 3' },
        ],
      );
    });
  });

  describe('array with 2 elements streamed in 1 chunk', () => {
    let result: StreamObjectResult<
      { content: string }[],
      { content: string }[],
      AsyncIterableStream<{ content: string }>
    >;

    let onFinishResult: Parameters<
      Required<Parameters<typeof streamObject>[0]>['onFinish']
    >[0];

    beforeEach(async () => {
      result = await streamObject({
        model: new MockLanguageModelV1({
          doStream: async ({ prompt, mode }) => {
            assert.deepStrictEqual(mode, {
              type: 'object-json',
              name: undefined,
              description: undefined,
              schema: {
                $schema: 'http://json-schema.org/draft-07/schema#',
                additionalProperties: false,
                properties: {
                  elements: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: { content: { type: 'string' } },
                      required: ['content'],
                      additionalProperties: false,
                    },
                  },
                },
                required: ['elements'],
                type: 'object',
              },
            });

            assert.deepStrictEqual(prompt, [
              {
                role: 'system',
                content:
                  'JSON schema:\n' +
                  `{\"$schema\":\"http://json-schema.org/draft-07/schema#\",\"type\":\"object\",\"properties\":{\"elements\":{\"type\":\"array\",\"items\":{\"type\":\"object\",\"properties\":{\"content\":{\"type\":\"string\"}},\"required\":[\"content\"],\"additionalProperties\":false}}},\"required\":[\"elements\"],\"additionalProperties\":false}` +
                  `\n` +
                  'You MUST answer with a JSON object that matches the JSON schema above.',
              },
              { role: 'user', content: [{ type: 'text', text: 'prompt' }] },
            ]);

            return {
              stream: convertArrayToReadableStream([
                {
                  type: 'text-delta',
                  textDelta:
                    '{"elements":[{"content":"element 1"},{"content":"element 2"}]}',
                },
                // finish
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { completionTokens: 10, promptTokens: 3 },
                },
              ]),
              rawCall: { rawPrompt: 'prompt', rawSettings: {} },
            };
          },
        }),
        schema: z.object({ content: z.string() }),
        output: 'array',
        mode: 'json',
        prompt: 'prompt',
        onFinish: async event => {
          onFinishResult = event as unknown as typeof onFinishResult;
        },
      });
    });

    it('should stream only complete objects in partialObjectStream', async () => {
      assert.deepStrictEqual(
        await convertAsyncIterableToArray(result.partialObjectStream),
        [[{ content: 'element 1' }, { content: 'element 2' }]],
      );
    });

    it('should stream only complete objects in textStream', async () => {
      assert.deepStrictEqual(
        await convertAsyncIterableToArray(result.textStream),
        ['[{"content":"element 1"},{"content":"element 2"}]'],
      );
    });

    it('should have the correct object result', async () => {
      // consume stream
      await convertAsyncIterableToArray(result.partialObjectStream);

      expect(await result.object).toStrictEqual([
        { content: 'element 1' },
        { content: 'element 2' },
      ]);
    });

    it('should call onFinish callback with full array', async () => {
      expect(onFinishResult.object).toStrictEqual([
        { content: 'element 1' },
        { content: 'element 2' },
      ]);
    });

    it('should stream elements individually in elementStream', async () => {
      assert.deepStrictEqual(
        await convertAsyncIterableToArray(result.elementStream),
        [{ content: 'element 1' }, { content: 'element 2' }],
      );
    });
  });
});

describe('output = "no-schema"', () => {
  it('should send object deltas with json mode', async () => {
    const result = await streamObject({
      model: new MockLanguageModelV1({
        doStream: async ({ prompt, mode }) => {
          assert.deepStrictEqual(mode, {
            type: 'object-json',
            name: undefined,
            description: undefined,
            schema: undefined,
          });

          assert.deepStrictEqual(prompt, [
            { role: 'system', content: 'You MUST answer with JSON.' },
            { role: 'user', content: [{ type: 'text', text: 'prompt' }] },
          ]);

          return {
            stream: convertArrayToReadableStream([
              { type: 'text-delta', textDelta: '{ ' },
              { type: 'text-delta', textDelta: '"content": ' },
              { type: 'text-delta', textDelta: `"Hello, ` },
              { type: 'text-delta', textDelta: `world` },
              { type: 'text-delta', textDelta: `!"` },
              { type: 'text-delta', textDelta: ' }' },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { completionTokens: 10, promptTokens: 3 },
              },
            ]),
            rawCall: { rawPrompt: 'prompt', rawSettings: {} },
          };
        },
      }),
      output: 'no-schema',
      prompt: 'prompt',
    });

    assert.deepStrictEqual(
      await convertAsyncIterableToArray(result.partialObjectStream),
      [
        {},
        { content: 'Hello, ' },
        { content: 'Hello, world' },
        { content: 'Hello, world!' },
      ],
    );
  });
});

describe('telemetry', () => {
  let tracer: MockTracer;

  beforeEach(() => {
    tracer = new MockTracer();
    setTestTracer(tracer);
  });

  afterEach(() => {
    setTestTracer(undefined);
  });

  it('should not record any telemetry data when not explicitly enabled', async () => {
    const result = await streamObject({
      model: new MockLanguageModelV1({
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            { type: 'text-delta', textDelta: '{ ' },
            { type: 'text-delta', textDelta: '"content": ' },
            { type: 'text-delta', textDelta: `"Hello, ` },
            { type: 'text-delta', textDelta: `world` },
            { type: 'text-delta', textDelta: `!"` },
            { type: 'text-delta', textDelta: ' }' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { completionTokens: 10, promptTokens: 3 },
            },
          ]),
          rawCall: { rawPrompt: 'prompt', rawSettings: {} },
        }),
      }),
      schema: z.object({ content: z.string() }),
      mode: 'json',
      prompt: 'prompt',
      _internal: { now: () => 0 },
    });

    // consume stream
    await convertAsyncIterableToArray(result.partialObjectStream);

    expect(tracer.jsonSpans).toMatchSnapshot();
  });

  it('should record telemetry data when enabled with mode "json"', async () => {
    const result = await streamObject({
      model: new MockLanguageModelV1({
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            { type: 'text-delta', textDelta: '{ ' },
            { type: 'text-delta', textDelta: '"content": ' },
            { type: 'text-delta', textDelta: `"Hello, ` },
            { type: 'text-delta', textDelta: `world` },
            { type: 'text-delta', textDelta: `!"` },
            { type: 'text-delta', textDelta: ' }' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { completionTokens: 10, promptTokens: 3 },
            },
          ]),
          rawCall: { rawPrompt: 'prompt', rawSettings: {} },
        }),
      }),
      schema: z.object({ content: z.string() }),
      schemaName: 'test-name',
      schemaDescription: 'test description',
      mode: 'json',
      prompt: 'prompt',
      topK: 0.1,
      topP: 0.2,
      frequencyPenalty: 0.3,
      presencePenalty: 0.4,
      temperature: 0.5,
      headers: {
        header1: 'value1',
        header2: 'value2',
      },
      experimental_telemetry: {
        isEnabled: true,
        functionId: 'test-function-id',
        metadata: {
          test1: 'value1',
          test2: false,
        },
      },
      _internal: { now: () => 0 },
    });

    // consume stream
    await convertAsyncIterableToArray(result.partialObjectStream);

    expect(tracer.jsonSpans).toMatchSnapshot();
  });

  it('should record telemetry data when enabled with mode "tool"', async () => {
    const result = await streamObject({
      model: new MockLanguageModelV1({
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            {
              type: 'tool-call-delta',
              toolCallType: 'function',
              toolCallId: 'tool-call-1',
              toolName: 'json',
              argsTextDelta: '{ ',
            },
            {
              type: 'tool-call-delta',
              toolCallType: 'function',
              toolCallId: 'tool-call-1',
              toolName: 'json',
              argsTextDelta: '"content": ',
            },
            {
              type: 'tool-call-delta',
              toolCallType: 'function',
              toolCallId: 'tool-call-1',
              toolName: 'json',
              argsTextDelta: `"Hello, `,
            },
            {
              type: 'tool-call-delta',
              toolCallType: 'function',
              toolCallId: 'tool-call-1',
              toolName: 'json',
              argsTextDelta: `world`,
            },
            {
              type: 'tool-call-delta',
              toolCallType: 'function',
              toolCallId: 'tool-call-1',
              toolName: 'json',
              argsTextDelta: `!"`,
            },
            {
              type: 'tool-call-delta',
              toolCallType: 'function',
              toolCallId: 'tool-call-1',
              toolName: 'json',
              argsTextDelta: ' }',
            },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { completionTokens: 10, promptTokens: 3 },
            },
          ]),
          rawCall: { rawPrompt: 'prompt', rawSettings: {} },
        }),
      }),
      schema: z.object({ content: z.string() }),
      schemaName: 'test-name',
      schemaDescription: 'test description',
      mode: 'tool',
      prompt: 'prompt',
      topK: 0.1,
      topP: 0.2,
      frequencyPenalty: 0.3,
      presencePenalty: 0.4,
      temperature: 0.5,
      headers: {
        header1: 'value1',
        header2: 'value2',
      },
      experimental_telemetry: {
        isEnabled: true,
        functionId: 'test-function-id',
        metadata: {
          test1: 'value1',
          test2: false,
        },
      },
      _internal: { now: () => 0 },
    });

    // consume stream
    await convertAsyncIterableToArray(result.partialObjectStream);

    expect(tracer.jsonSpans).toMatchSnapshot();
  });

  it('should not record telemetry inputs / outputs when disabled with mode "json"', async () => {
    const result = await streamObject({
      model: new MockLanguageModelV1({
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            { type: 'text-delta', textDelta: '{ ' },
            { type: 'text-delta', textDelta: '"content": ' },
            { type: 'text-delta', textDelta: `"Hello, ` },
            { type: 'text-delta', textDelta: `world` },
            { type: 'text-delta', textDelta: `!"` },
            { type: 'text-delta', textDelta: ' }' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { completionTokens: 10, promptTokens: 3 },
            },
          ]),
          rawCall: { rawPrompt: 'prompt', rawSettings: {} },
        }),
      }),
      schema: z.object({ content: z.string() }),
      mode: 'json',
      prompt: 'prompt',
      experimental_telemetry: {
        isEnabled: true,
        recordInputs: false,
        recordOutputs: false,
      },
      _internal: { now: () => 0 },
    });

    // consume stream
    await convertAsyncIterableToArray(result.partialObjectStream);

    expect(tracer.jsonSpans).toMatchSnapshot();
  });

  it('should not record telemetry inputs / outputs when disabled with mode "tool"', async () => {
    const result = await streamObject({
      model: new MockLanguageModelV1({
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            {
              type: 'tool-call-delta',
              toolCallType: 'function',
              toolCallId: 'tool-call-1',
              toolName: 'json',
              argsTextDelta: '{ ',
            },
            {
              type: 'tool-call-delta',
              toolCallType: 'function',
              toolCallId: 'tool-call-1',
              toolName: 'json',
              argsTextDelta: '"content": ',
            },
            {
              type: 'tool-call-delta',
              toolCallType: 'function',
              toolCallId: 'tool-call-1',
              toolName: 'json',
              argsTextDelta: `"Hello, `,
            },
            {
              type: 'tool-call-delta',
              toolCallType: 'function',
              toolCallId: 'tool-call-1',
              toolName: 'json',
              argsTextDelta: `world`,
            },
            {
              type: 'tool-call-delta',
              toolCallType: 'function',
              toolCallId: 'tool-call-1',
              toolName: 'json',
              argsTextDelta: `!"`,
            },
            {
              type: 'tool-call-delta',
              toolCallType: 'function',
              toolCallId: 'tool-call-1',
              toolName: 'json',
              argsTextDelta: ' }',
            },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { completionTokens: 10, promptTokens: 3 },
            },
          ]),
          rawCall: { rawPrompt: 'prompt', rawSettings: {} },
        }),
      }),
      schema: z.object({ content: z.string() }),
      mode: 'tool',
      prompt: 'prompt',
      experimental_telemetry: {
        isEnabled: true,
        recordInputs: false,
        recordOutputs: false,
      },
      _internal: { now: () => 0 },
    });

    // consume stream
    await convertAsyncIterableToArray(result.partialObjectStream);

    expect(tracer.jsonSpans).toMatchSnapshot();
  });
});
