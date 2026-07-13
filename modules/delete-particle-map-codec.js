export const DELETE_PARTICLE_MAP_MAGIC = "DPM1";
export const DELETE_PARTICLE_MAP_HEADER_SIZE = 16;

function readMagic(bytes) {
  return String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
}

export function decodeDeleteParticleMap(buffer) {
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < DELETE_PARTICLE_MAP_HEADER_SIZE) {
    throw new Error("Delete particle map is truncated");
  }
  const bytes = new Uint8Array(buffer);
  if (readMagic(bytes) !== DELETE_PARTICLE_MAP_MAGIC) {
    throw new Error("Delete particle map has an invalid signature");
  }
  const view = new DataView(buffer);
  const version = view.getUint8(4);
  const flags = view.getUint8(5);
  const width = view.getUint16(6, true);
  const height = view.getUint16(8, true);
  const trajectoryCount = view.getUint16(10, true);
  const delayCodeMax = view.getUint16(12, true);
  const bytesPerPixel = view.getUint16(14, true);
  if (version !== 1 || flags !== 0 || bytesPerPixel !== 2) {
    throw new Error("Unsupported delete particle map format");
  }
  const payloadLength = width * height * bytesPerPixel;
  if (buffer.byteLength !== DELETE_PARTICLE_MAP_HEADER_SIZE + payloadLength) {
    throw new Error("Delete particle map has an invalid size");
  }
  return {
    width,
    height,
    trajectoryCount,
    delayCodeMax,
    particleValues: new Uint16Array(buffer, DELETE_PARTICLE_MAP_HEADER_SIZE, width * height),
  };
}

export async function loadDeleteParticleMap(url, fetchImpl = fetch) {
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error(`Unable to load delete particle map (${response.status})`);
  return decodeDeleteParticleMap(await response.arrayBuffer());
}
