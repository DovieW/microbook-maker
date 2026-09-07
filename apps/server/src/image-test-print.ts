import fs from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';
import { imageOutputSchema, imageOutputQuery } from '@microbook/core';
import type { ImageOutputCache } from './image-output.ts';
export type PrintSample = { file: string; mediaType: string; title: string; source: string };
const escape = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
export function imageTestPrint(directory: string, cache: ImageOutputCache) {
  const router = Router();
  const samples = async (): Promise<PrintSample[]> => {
    try {
      return JSON.parse(await fs.readFile(path.join(directory, 'samples.json'), 'utf8'));
    } catch (error: any) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }
  };
  router.get('/assets/:index', async (req, res) => {
    const list = await samples();
    const sample = /^\d+$/.test(req.params.index) ? list[Number(req.params.index)] : undefined;
    if (!sample || path.basename(sample.file) !== sample.file) return res.sendStatus(404);
    const output = imageOutputSchema.parse({ mode: req.query.output, strength: req.query.strength });
    const file = await cache.process(path.join(directory, sample.file), output);
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    res
      .type(output.mode === 'original' ? sample.mediaType : 'image/png')
      .sendFile(file, { dotfiles: 'allow' });
  });
  router.get('/', async (_req, res) => {
    const list = await samples();
    const columns = [
      { label: 'Original color', mode: 'original', strength: 'gentle' },
      { label: 'Grayscale', mode: 'grayscale', strength: 'gentle' },
      { label: 'Laser · Gentle', mode: 'laser', strength: 'gentle' },
      { label: 'Laser · Standard', mode: 'laser', strength: 'standard' },
      { label: 'Laser · Strong', mode: 'laser', strength: 'strong' },
    ] as const;
    res.type('html')
      .send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MicroBook image test print</title><style>
      *{box-sizing:border-box}body{font:14px Arial,sans-serif;color:#000;background:#edf1f3;margin:0;padding:16px}header{max-width:11in;margin:0 auto 16px;display:flex;gap:12px;align-items:center;flex-wrap:wrap}button,a{font:inherit;padding:12px 18px;color:#000}button{background:#8dd3bd;border:1px solid #000;border-radius:6px;cursor:pointer}button:disabled{opacity:.6}h1{font-size:18px;margin:0 0 8px}p{margin:4px 0;font-size:11px}main{background:white;width:10.2in;padding:0;margin:auto}.sheet{padding:.15in}.grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:.08in}.column{font-weight:bold;text-align:center;font-size:11px;padding:6px 0;border-bottom:1px solid #000}.sample{margin:0;padding:4px;text-align:center;break-inside:avoid}.sample img{display:block;width:100%;height:1.7in;object-fit:contain}.sample figcaption{font-size:9px;line-height:1.3;margin-top:4px}.note{margin-top:10px}#status{font-size:13px}.scroll{overflow:auto}
      @page{size:Letter landscape;margin:.4in}@media print{body{background:#fff;padding:0}header{display:none}main{width:100%;margin:0}.sheet{padding:0}*{color:#000!important;print-color-adjust:exact;-webkit-print-color-adjust:exact}}
    </style></head><body><header><button id="print" disabled>Print test sheet</button><span id="status" role="status">Preparing comparisons…</span><a href="/">Return to MicroBook</a></header><div class="scroll"><main class="sheet"><h1>MicroBook · Image output comparison</h1><p>Print at 100% / actual size on Letter paper, landscape. Turn off Toner Save for this comparison.</p><p>Compare fine lines, pale chart colors, and shadow detail. Original color uses your printer’s own grayscale conversion.</p>
    ${
      list.length
        ? `<div class="grid">${columns.map((c) => `<div class="column">${c.label}</div>`).join('')}${list
            .slice(0, 3)
            .map((sample, i) =>
              columns
                .map(
                  (c) =>
                    `<figure class="sample"><img src="/api/image-test-print/assets/${i}${imageOutputQuery(c)}" alt="${escape(sample.title)}"><figcaption>${escape(sample.title)}<br>${escape(sample.source)}</figcaption></figure>`,
                )
                .join(''),
            )
            .join(
              '',
            )}</div><p class="note">The same original images and physical sizes are used in every column. Gentle is the default; stronger contrast can lose light strokes or shadow detail.</p>`
        : '<p>No test images are available on this server yet.</p>'
    }
    </main></div><script>
      const button=document.getElementById('print'),status=document.getElementById('status');
      Promise.all(Array.from(document.images,img=>img.decode())).then(()=>{if(!document.images.length){status.textContent='No test images available';return;}button.disabled=false;status.textContent='Ready · 1 printed side';}).catch(()=>{status.textContent='An image could not load. Reload to retry before printing.';});
      button.addEventListener('click',()=>window.print());
    </script></body></html>`);
  });
  return router;
}
