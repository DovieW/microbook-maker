import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
export async function thumbnail(base64: string, workerUrl: string) {
  GlobalWorkerOptions.workerSrc = workerUrl;
  const loading = getDocument({
    data: Uint8Array.from(atob(base64), (character) => character.charCodeAt(0)),
  });
  const pdf = await loading.promise;
  const first = await pdf.getPage(1);
  const viewport = first.getViewport({ scale: 0.6 });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  document.body.replaceChildren(canvas);
  await first.render({ canvas, viewport }).promise;
  const result = canvas.toDataURL('image/png');
  await loading.destroy();
  return result;
}
