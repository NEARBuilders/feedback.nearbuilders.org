/**
 * One-click screenshot for feedback (#299). It uses the browser's own screen capture, so the
 * tester picks the tab or window and the browser asks for permission every time. Nothing is
 * captured silently, nothing is sent until the tester posts, and no library is involved. The
 * captured frame becomes an ordinary image in the feedback, which the tester can delete like
 * any other.
 */

/** Whether this browser can capture a screen. False on the server and on most phones. */
export function canCaptureScreen(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getDisplayMedia === "function"
  );
}

/** Asks the browser for a screen, grabs one frame and returns it as a PNG. Null if cancelled. */
export async function captureScreenshot(): Promise<File | null> {
  if (!canCaptureScreen()) return null;
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false,
      // Chromium: offer the current tab first, which is the page the tester is describing.
      preferCurrentTab: true,
    } as DisplayMediaStreamOptions);
  } catch {
    return null; // the tester dismissed the picker, or the browser refused
  }

  try {
    const video = document.createElement("video");
    video.muted = true;
    video.srcObject = stream;
    await video.play();
    // The first frame can be blank until the stream settles.
    await new Promise((resolve) => setTimeout(resolve, 150));

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    if (!canvas.width || !canvas.height) return null;
    canvas.getContext("2d")?.drawImage(video, 0, 0);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    return blob ? new File([blob], `screenshot-${Date.now()}.png`, { type: "image/png" }) : null;
  } finally {
    for (const track of stream.getTracks()) track.stop();
  }
}

/** The markdown that places an uploaded screenshot at the end of the feedback. */
export function appendScreenshot(body: string, url: string): string {
  const separator = body.trim() ? "\n\n" : "";
  return `${body.trimEnd()}${separator}![Screenshot](${url})\n`;
}
