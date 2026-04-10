import { Communicate, listVoices, type Voice } from "edge-tts-universal/isomorphic";

export const DEFAULT_VOICE = "zh-CN-Xiaoxiao:DragonHDFlashLatestNeural";

export type TtsInput = {
  text: string;
  voice?: string;
};

export async function createAudioStream({
  text,
  voice,
}: TtsInput): Promise<ReadableStream<Uint8Array>> {
  const iterator = new Communicate(text, {
    voice: voice ?? DEFAULT_VOICE,
  }).stream();

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        while (true) {
          const { done, value } = await iterator.next();

          if (done) {
            controller.close();
            return;
          }

          if (value.type === "audio" && value.data) {
            controller.enqueue(value.data);
            return;
          }
        }
      } catch (error) {
        controller.error(error);
      }
    },
    async cancel() {
      if (typeof iterator.return === "function") {
        await iterator.return();
      }
    },
  });
}

export async function getVoices(): Promise<Voice[]> {
  return listVoices();
}
