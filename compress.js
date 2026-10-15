// Compressão de vídeo no navegador (WebCodecs via mediabunny). Gera MP4 H.264 + AAC.
import {
  Input, Output, Conversion, ALL_FORMATS, BlobSource, BufferTarget, Mp4OutputFormat,
  canEncodeVideo, canEncodeAudio,
} from "./vendor/mediabunny.min.mjs";

// maxSide: maior lado em pixels; bpp: bits por pixel por quadro (H.264).
export const PRESETS = {
  max:   { maxSide: 720, bpp: 0.045, maxFps: 24, audioKbps: 48 },   // menor arquivo
  balanced: { maxSide: 960, bpp: 0.06, maxFps: 30, audioKbps: 64 }, // padrão
};

const even = n => Math.max(2, Math.round(n / 2) * 2);

export async function compressVideo(file, { preset = "balanced", keepAudio = true, onProgress } = {}) {
  const p = PRESETS[preset] || PRESETS.balanced;
  if (!(await canEncodeVideo("avc"))) throw new Error("Este navegador não consegue codificar H.264 (use Chrome, Edge ou Safari).");

  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  const vTrack = await input.getPrimaryVideoTrack();
  if (!vTrack) throw new Error("Arquivo sem faixa de vídeo.");

  // Tamanho final: nunca amplia.
  let w = vTrack.displayWidth, h = vTrack.displayHeight;
  const scale = Math.min(1, p.maxSide / Math.max(w, h));
  w = even(w * scale); h = even(h * scale);

  // Taxa de quadros: nunca aumenta.
  const stats = await vTrack.computePacketStats(120);
  const fps = Math.min(p.maxFps, Math.round(stats.averagePacketRate) || p.maxFps);

  // Bitrate de vídeo proporcional à área, com piso e teto.
  const videoBps = Math.min(1_500_000, Math.max(250_000, Math.round(w * h * fps * p.bpp)));

  const aTrack = keepAudio ? await input.getPrimaryAudioTrack() : null;
  let audio = { discard: true };
  if (aTrack) {
    audio = {};  // padrão: mantém o áudio original sem recodificar
    // Nem toda combinação é aceita pelo encoder: usa a primeira que o navegador suportar.
    for (const [numberOfChannels, sampleRate] of [[1, 44100], [1, 48000], [2, 44100], [2, 48000]]) {
      const cfg = { numberOfChannels, sampleRate, bitrate: p.audioKbps * 1000 };
      if (await canEncodeAudio("aac", cfg)) { audio = { codec: "aac", ...cfg }; break; }
    }
  }

  const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target: new BufferTarget() });
  const conversion = await Conversion.init({
    input, output,
    video: { codec: "avc", width: w, height: h, fit: "contain", frameRate: fps, bitrate: videoBps, keyFrameInterval: 2 },
    audio,
  });
  if (!conversion.isValid) throw new Error("Vídeo não suportado para conversão.");
  conversion.onProgress = pr => onProgress && onProgress(pr);
  await conversion.execute();
  const audioKept = conversion.utilizedTracks.some(t => t.isAudioTrack());

  const blob = new Blob([output.target.buffer], { type: "video/mp4" });
  return { blob, width: w, height: h, fps, videoKbps: Math.round(videoBps / 1000), audio: audioKept, audioDropped: !!aTrack && keepAudio && !audioKept };
}
