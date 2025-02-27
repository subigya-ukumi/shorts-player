declare module '@ffmpeg/util' {
  export function fetchFile(file: File | string): Promise<Uint8Array>;
}
