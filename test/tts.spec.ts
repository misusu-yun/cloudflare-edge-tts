import { beforeEach, describe, expect, it, vi } from "vitest";

const { communicateConstructor, streamFactory, listVoicesMock } = vi.hoisted(() => ({
  communicateConstructor: vi.fn(),
  streamFactory: vi.fn(),
  listVoicesMock: vi.fn(),
}));

vi.mock("edge-tts-universal/isomorphic", () => {
  class Communicate {
    constructor(text: string, options: { voice?: string }) {
      communicateConstructor(text, options);
    }

    stream() {
      return streamFactory();
    }
  }

  return {
    Communicate,
    listVoices: listVoicesMock,
  };
});

import { DEFAULT_VOICE, createAudioStream, getVoices } from "../src/lib/tts";

function makeChunkStream(chunks: Array<Record<string, unknown>>) {
  return (async function* () {
    for (const chunk of chunks) {
      yield chunk;
    }
  })();
}

async function readAll(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  return merged;
}

describe("createAudioStream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the default voice and forwards only audio chunks", async () => {
    streamFactory.mockReturnValueOnce(
      makeChunkStream([
        { type: "WordBoundary", text: "hello" },
        { type: "audio", data: new Uint8Array([1, 2]) },
        { type: "SentenceBoundary", text: "hello" },
        { type: "audio", data: new Uint8Array([3, 4]) },
      ])
    );

    const stream = await createAudioStream({ text: "hello" });

    expect(communicateConstructor).toHaveBeenCalledWith("hello", {
      voice: DEFAULT_VOICE,
    });

    const bytes = await readAll(stream);
    expect(Array.from(bytes)).toEqual([1, 2, 3, 4]);
  });

  it("passes through an explicit voice", async () => {
    streamFactory.mockReturnValueOnce(
      makeChunkStream([{ type: "audio", data: new Uint8Array([9]) }])
    );

    const stream = await createAudioStream({
      text: "hello",
      voice: "en-US-EmmaMultilingualNeural",
    });

    await readAll(stream);

    expect(communicateConstructor).toHaveBeenCalledWith("hello", {
      voice: "en-US-EmmaMultilingualNeural",
    });
  });
});

describe("getVoices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the vendor voice list", async () => {
    listVoicesMock.mockResolvedValueOnce([
      {
        Name: "Microsoft Server Speech Text to Speech Voice (zh-CN, XiaoxiaoNeural)",
        ShortName: "zh-CN-XiaoxiaoNeural",
        Gender: "Female",
        Locale: "zh-CN",
        SuggestedCodec: "audio-24khz-48kbitrate-mono-mp3",
        FriendlyName: "Microsoft Xiaoxiao Online (Natural) - Chinese (Mainland)",
        Status: "GA",
        VoiceTag: {
          ContentCategories: ["General"],
          VoicePersonalities: ["Friendly"],
        },
      },
    ]);

    const voices = await getVoices();

    expect(voices).toHaveLength(1);
    expect(voices[0]?.ShortName).toBe("zh-CN-XiaoxiaoNeural");
  });
});
