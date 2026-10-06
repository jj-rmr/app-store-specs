export function validateMarkdownText(
  name: string,
  text: string,
  maxCharacters = 50000,
): { name: string; text: string } {
  if (!text.trim()) throw new Error("That file is empty. Pick a file with content.");
  if (text.length > maxCharacters) {
    throw new Error(`That file is too long. Keep it under ${maxCharacters} characters.`);
  }
  // file.text() decodes as UTF-8, replacing invalid bytes with U+FFFD,
  // so binary files (zip, exe, pdf) show up as replacement chars / control codes.
  const sample = text.slice(0, 4000);
  let suspicious = 0;
  for (const ch of sample) {
    const code = ch.codePointAt(0) ?? 0;
    if (code === 0 || code === 0xfffd || (code < 32 && code !== 9 && code !== 10 && code !== 13)) {
      suspicious++;
    }
  }
  if (suspicious / sample.length > 0.02) {
    throw new Error("That doesn't look like a text file. Pick a Markdown or README file.");
  }
  return { name, text };
}

// Reads a user-picked Markdown or text file, including extensionless READMEs.
export async function readMarkdownFile(
  file: File | undefined,
): Promise<{ name: string; text: string }> {
  if (!file) throw new Error("No file selected.");
  if (
    file.type.startsWith("image/") ||
    file.type.startsWith("video/") ||
    file.type.startsWith("audio/")
  ) {
    throw new Error("That is a media file. Pick a Markdown or text file instead.");
  }
  if (file.size > 200_000) throw new Error("That file is too big. Keep it under 200KB.");
  const text = await file.text().catch(() => {
    throw new Error("Could not read that file.");
  });
  return validateMarkdownText(file.name, text);
}
