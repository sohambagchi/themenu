import { inflateSync } from "node:zlib";

interface ParsedPdfObject {
  id: number;
  dictText: string;
  streamData: Buffer | null;
}

function toLatin1(input: Buffer) {
  return input.toString("latin1");
}

function parseObjects(buffer: Buffer): ParsedPdfObject[] {
  const source = toLatin1(buffer);
  const objects: ParsedPdfObject[] = [];
  const objectHeaderRe = /(\d+)\s+(\d+)\s+obj/g;
  let match: RegExpExecArray | null;

  while ((match = objectHeaderRe.exec(source))) {
    const id = Number(match[1]);
    const bodyStart = match.index + match[0].length;
    const bodyEnd = source.indexOf("endobj", bodyStart);
    if (bodyEnd < 0) continue;

    const body = source.slice(bodyStart, bodyEnd);
    const streamIndex = body.indexOf("stream");

    if (streamIndex < 0) {
      objects.push({ id, dictText: body, streamData: null });
      continue;
    }

    const dictText = body.slice(0, streamIndex);
    let streamStart = streamIndex + "stream".length;
    if (body[streamStart] === "\r" && body[streamStart + 1] === "\n") {
      streamStart += 2;
    } else if (body[streamStart] === "\n") {
      streamStart += 1;
    }

    const streamEnd = body.indexOf("endstream", streamStart);
    if (streamEnd < 0) {
      objects.push({ id, dictText, streamData: null });
      continue;
    }

    const rawStream = body.slice(streamStart, streamEnd);
    objects.push({
      id,
      dictText,
      streamData: Buffer.from(rawStream, "latin1")
    });
  }

  return objects;
}

function decodeObjectStream(object: ParsedPdfObject) {
  if (!object.streamData) return null;
  const dict = object.dictText;
  const streamData = object.streamData;

  if (/\/Filter\s*\/FlateDecode/.test(dict) || /\/Filter\s*\[\s*\/FlateDecode/.test(dict)) {
    try {
      return inflateSync(streamData);
    } catch {
      return null;
    }
  }

  return streamData;
}

function parseFontNameToObject(objects: ParsedPdfObject[]) {
  const result = new Map<string, number>();
  for (const object of objects) {
    const re = /\/Font\s*<<([\s\S]*?)>>/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(object.dictText))) {
      const block = match[1];
      const entryRe = /\/([A-Za-z0-9]+)\s+(\d+)\s+0\s+R/g;
      let entry: RegExpExecArray | null;
      while ((entry = entryRe.exec(block))) {
        if (!result.has(entry[1])) {
          result.set(entry[1], Number(entry[2]));
        }
      }
    }
  }
  return result;
}

function parseFontObjectToCMapObject(objects: ParsedPdfObject[]) {
  const result = new Map<number, number>();
  for (const object of objects) {
    const match = object.dictText.match(/\/ToUnicode\s+(\d+)\s+0\s+R/);
    if (!match) continue;
    result.set(object.id, Number(match[1]));
  }
  return result;
}

function decodeUtf16BeHex(hex: string) {
  if (!hex) return "";
  const normalized = hex.length % 2 === 0 ? hex : `0${hex}`;
  const bytes = Buffer.from(normalized, "hex");
  if (bytes.length < 2) return bytes.toString("latin1");

  let value = "";
  for (let index = 0; index + 1 < bytes.length; index += 2) {
    const codePoint = (bytes[index] << 8) | bytes[index + 1];
    value += String.fromCharCode(codePoint);
  }
  return value;
}

function toUpperHex(value: number, width: number) {
  return value.toString(16).toUpperCase().padStart(width, "0");
}

function parseCMapText(cmapText: string) {
  const map = new Map<string, string>();

  const bfcharRe = /(\d+)\s+beginbfchar([\s\S]*?)endbfchar/g;
  let bfcharMatch: RegExpExecArray | null;
  while ((bfcharMatch = bfcharRe.exec(cmapText))) {
    const block = bfcharMatch[2];
    const pairRe = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g;
    let pairMatch: RegExpExecArray | null;
    while ((pairMatch = pairRe.exec(block))) {
      map.set(pairMatch[1].toUpperCase(), decodeUtf16BeHex(pairMatch[2]));
    }
  }

  const bfrangeRe = /(\d+)\s+beginbfrange([\s\S]*?)endbfrange/g;
  let bfrangeMatch: RegExpExecArray | null;
  while ((bfrangeMatch = bfrangeRe.exec(cmapText))) {
    const block = bfrangeMatch[2];

    const sequentialRe = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g;
    let seqMatch: RegExpExecArray | null;
    while ((seqMatch = sequentialRe.exec(block))) {
      const startHex = seqMatch[1].toUpperCase();
      const endHex = seqMatch[2].toUpperCase();
      const outStartHex = seqMatch[3].toUpperCase();
      const start = Number.parseInt(startHex, 16);
      const end = Number.parseInt(endHex, 16);
      const outStart = Number.parseInt(outStartHex, 16);
      const inWidth = startHex.length;
      const outWidth = outStartHex.length;

      for (let code = start; code <= end; code += 1) {
        const sourceHex = toUpperHex(code, inWidth);
        const targetHex = toUpperHex(outStart + (code - start), outWidth);
        map.set(sourceHex, decodeUtf16BeHex(targetHex));
      }
    }

    const explicitRe = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*\[([^\]]+)\]/g;
    let explicitMatch: RegExpExecArray | null;
    while ((explicitMatch = explicitRe.exec(block))) {
      const startHex = explicitMatch[1].toUpperCase();
      const endHex = explicitMatch[2].toUpperCase();
      const start = Number.parseInt(startHex, 16);
      const end = Number.parseInt(endHex, 16);
      const inWidth = startHex.length;
      const values = Array.from(explicitMatch[3].matchAll(/<([0-9A-Fa-f]+)>/g)).map((entry) => entry[1]);

      for (let offset = 0; offset <= end - start; offset += 1) {
        const sourceHex = toUpperHex(start + offset, inWidth);
        const targetHex = values[offset];
        if (!targetHex) continue;
        map.set(sourceHex, decodeUtf16BeHex(targetHex));
      }
    }
  }

  return map;
}

function parseCMaps(objects: ParsedPdfObject[]) {
  const map = new Map<number, Map<string, string>>();
  for (const object of objects) {
    const decoded = decodeObjectStream(object);
    if (!decoded) continue;
    const text = toLatin1(decoded);
    if (!text.includes("begincmap")) continue;
    map.set(object.id, parseCMapText(text));
  }
  return map;
}

function decodeHexRun(hex: string, cmap: Map<string, string> | null) {
  if (!hex) return "";
  const normalized = hex.toUpperCase();

  if (!cmap || cmap.size === 0) {
    return decodeUtf16BeHex(normalized);
  }

  const keyLengths = Array.from(new Set(Array.from(cmap.keys()).map((key) => key.length))).sort(
    (a, b) => b - a
  );
  const fallbackWidth = keyLengths[keyLengths.length - 1] ?? 4;
  let index = 0;
  let output = "";

  while (index < normalized.length) {
    let matched = false;
    for (const width of keyLengths) {
      const slice = normalized.slice(index, index + width);
      if (slice.length !== width) continue;
      const mapped = cmap.get(slice);
      if (mapped === undefined) continue;
      output += mapped;
      index += width;
      matched = true;
      break;
    }
    if (matched) continue;

    const fallback = normalized.slice(index, index + fallbackWidth);
    output += decodeUtf16BeHex(fallback);
    index += fallbackWidth;
  }

  return output;
}

function decodeLiteralText(raw: string) {
  return raw
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\");
}

function decodeTjArray(arrayBody: string, cmap: Map<string, string> | null) {
  const parts = Array.from(arrayBody.matchAll(/<([0-9A-Fa-f]+)>|\(([^)]*)\)|(-?\d+(?:\.\d+)?)/g));
  let output = "";
  for (const part of parts) {
    if (part[1]) {
      output += decodeHexRun(part[1], cmap);
      continue;
    }
    if (part[2]) {
      output += decodeLiteralText(part[2]);
      continue;
    }
    if (part[3]) {
      const kerning = Number(part[3]);
      if (Number.isFinite(kerning) && kerning < -150) {
        output += " ";
      }
    }
  }
  return output;
}

function extractTextFromStream(
  streamText: string,
  fontNameToObject: Map<string, number>,
  fontObjectToCMapObject: Map<number, number>,
  cMaps: Map<number, Map<string, string>>
) {
  if (!streamText.includes("BT")) return "";

  const tokenRe =
    /\/([A-Za-z0-9]+)\s+[-\d.]+\s+Tf|<([0-9A-Fa-f]+)>\s*Tj|\(([^)]*)\)\s*Tj|\[([^\]]+)\]\s*TJ|([-\d.]+)\s+([-\d.]+)\s+Td|\bT\*\b|\bBT\b|\bET\b/g;

  let currentFontName: string | null = null;
  let output = "";
  let token: RegExpExecArray | null;

  while ((token = tokenRe.exec(streamText))) {
    if (token[1]) {
      currentFontName = token[1];
      continue;
    }

    const fontObject = currentFontName ? fontNameToObject.get(currentFontName) : undefined;
    const cmapObject = fontObject ? fontObjectToCMapObject.get(fontObject) : undefined;
    const cmap = cmapObject ? cMaps.get(cmapObject) ?? null : null;

    if (token[2]) {
      output += decodeHexRun(token[2], cmap);
      continue;
    }
    if (token[3]) {
      output += decodeLiteralText(token[3]);
      continue;
    }
    if (token[4]) {
      output += decodeTjArray(token[4], cmap);
      continue;
    }
    if (token[5] !== undefined && token[6] !== undefined) {
      const y = Number(token[6]);
      const x = Number(token[5]);
      if (Number.isFinite(y) && Math.abs(y) > 0.001) {
        output += "\n";
      } else if (Number.isFinite(x) && x > 25) {
        output += " ";
      }
      continue;
    }
    if (token[0] === "T*") {
      output += "\n";
      continue;
    }
    if (token[0] === "ET") {
      output += "\n";
    }
  }

  return output;
}

function cleanupExtractedText(raw: string) {
  return raw
    .replace(/\r/g, "\n")
    .replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\uFFFF]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export async function extractTextFromWalmartPdf(buffer: Buffer) {
  const objects = parseObjects(buffer);
  const fontNameToObject = parseFontNameToObject(objects);
  const fontObjectToCMapObject = parseFontObjectToCMapObject(objects);
  const cMaps = parseCMaps(objects);

  let combinedText = "";
  for (const object of objects.sort((a, b) => a.id - b.id)) {
    const decoded = decodeObjectStream(object);
    if (!decoded) continue;
    const streamText = toLatin1(decoded);
    combinedText += `\n${extractTextFromStream(streamText, fontNameToObject, fontObjectToCMapObject, cMaps)}`;
  }

  const cleaned = cleanupExtractedText(combinedText);
  if (!cleaned) {
    throw new Error("Could not extract text from PDF using JS parser.");
  }

  return cleaned;
}
