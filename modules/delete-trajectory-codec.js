export const DELETE_TRAJECTORY_MAGIC = "DTV2";
export const DELETE_TRAJECTORY_HEADER_SIZE = 16;

function readMagic(bytes) {
  return String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
}

export function decodeDeleteTrajectoryFile(buffer) {
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < DELETE_TRAJECTORY_HEADER_SIZE) {
    throw new Error("Delete trajectory file is truncated");
  }

  const bytes = new Uint8Array(buffer);
  if (readMagic(bytes) !== DELETE_TRAJECTORY_MAGIC) {
    throw new Error("Delete trajectory file has an invalid signature");
  }

  const view = new DataView(buffer);
  const version = view.getUint8(4);
  const flags = view.getUint8(5);
  const width = view.getUint16(6, true);
  const height = view.getUint16(8, true);
  const trajectoryCount = view.getUint16(10, true);
  const frameCount = view.getUint16(12, true);
  const fps = view.getUint16(14, true);

  if (version !== 2 || flags !== 0) {
    throw new Error("Unsupported delete trajectory format");
  }
  if (!width || !height || !trajectoryCount || !frameCount || !fps) {
    throw new Error("Delete trajectory file has invalid dimensions");
  }

  const trajectoryByteLength = frameCount * trajectoryCount * 3;
  const expectedSize = DELETE_TRAJECTORY_HEADER_SIZE + trajectoryByteLength;
  if (buffer.byteLength !== expectedSize) {
    throw new Error(`Delete trajectory file size is ${buffer.byteLength}; expected ${expectedSize}`);
  }

  return {
    width,
    height,
    trajectoryCount,
    frameCount,
    fps,
    trajectoryBytes: new Uint8Array(buffer, DELETE_TRAJECTORY_HEADER_SIZE, trajectoryByteLength),
  };
}

export async function loadDeleteTrajectoryFile(url, fetchImpl = fetch) {
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error(`Unable to load delete trajectories (${response.status})`);
  return decodeDeleteTrajectoryFile(await response.arrayBuffer());
}
