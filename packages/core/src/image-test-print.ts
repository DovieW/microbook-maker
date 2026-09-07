import { imageOutputQuery, imageOutputModes, laserContrastLevels } from './image-output.ts';
const escape = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
export function renderImageTestPrint(
  list: { file: string; mediaType: string; title: string; source: string }[],
) {
  const columns = [
    { mode: 'original', strength: 'gentle' },
    { mode: 'grayscale', strength: 'gentle' },
    ...laserContrastLevels.map((level) => ({ mode: 'laser' as const, strength: level.value })),
  ] as const;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MicroBook image test print</title><style>
      *{box-sizing:border-box}body{font:14px Arial,sans-serif;color:#000;background:#edf1f3;margin:0;padding:16px}header{max-width:11in;margin:0 auto 16px;display:flex;gap:12px;align-items:center;flex-wrap:wrap}button,a{font:inherit;padding:12px 18px;color:#000}button{background:#8dd3bd;border:1px solid #000;border-radius:6px;cursor:pointer}button:disabled{opacity:.6}h1{font-size:18px;margin:0 0 8px}p{margin:4px 0;font-size:11px}main{background:white;width:10.2in;padding:0;margin:auto}.sheet{padding:.15in}.comparison{width:100%;table-layout:fixed;border-collapse:collapse;margin-top:12px}.comparison th{font-size:12px;text-align:center;vertical-align:top;padding:7px;border-bottom:1px solid #000}.comparison th small{display:block;font-weight:normal;font-size:10px;line-height:1.35;margin-top:5px}.comparison td{vertical-align:top;padding:4px}.configure{padding:8px 0;border-bottom:1px solid #000;font-size:12px;line-height:1.4}.sample{margin:0;padding:4px;text-align:center;break-inside:avoid}.sample img{display:block;width:100%;height:1.5in;object-fit:contain}.comparison tbody tr:nth-child(2) img{height:1in}.sample figcaption{font-size:9px;line-height:1.3;margin-top:4px}.note{margin-top:10px}#status{font-size:13px}.scroll{overflow:auto}
      @page{size:Letter landscape;margin:.4in}@media print{body{background:#fff;padding:0}header{display:none}main{width:100%;margin:0}.sheet{padding:0}*{color:#000!important;print-color-adjust:exact;-webkit-print-color-adjust:exact}}
    </style></head><body><header><button id="print" disabled>Print test sheet</button><span id="status" role="status">Preparing comparisons…</span><a href="/">Return to MicroBook</a></header><div class="scroll"><main class="sheet"><h1>MicroBook · Image output comparison</h1><p>Print at 100% / actual size on Letter paper, landscape. Turn off Toner Save for this comparison.</p><p class="configure"><strong>Use your preferred result:</strong> Open <strong>Images → Defaults → Image output</strong> in MicroBook. For <strong>Laser optimized</strong>, choose the matching <strong>Laser contrast</strong> below it, then press <strong>Apply</strong>.</p>
    ${
      list.length
        ? `<table class="comparison" aria-label="Image output settings comparison"><thead><tr>${imageOutputModes
            .slice(0, 2)
            .map((mode) => `<th scope="col" rowspan="2">${mode.label}<small>${mode.description}</small></th>`)
            .join(
              '',
            )}<th scope="colgroup" colspan="3">${imageOutputModes[2].label}<small>Grayscale with extra contrast · choose Laser contrast</small></th></tr><tr>${laserContrastLevels.map((level) => `<th scope="col">${level.label}<small>${level.description}</small></th>`).join('')}</tr></thead><tbody>${list
            .slice(0, 3)
            .map(
              (sample, i) =>
                `<tr>${columns.map((c) => `<td><figure class="sample"><img src="/api/image-test-print/assets/${i}${imageOutputQuery(c)}" alt="${escape(sample.title)}"><figcaption>${escape(sample.title)}<br>${escape(sample.source)}</figcaption></figure></td>`).join('')}</tr>`,
            )
            .join(
              '',
            )}</tbody></table><p class="note">All five columns use the same images at the same size. Compare fine lines, pale colors, and shadow detail. These are MicroBook settings, not printer-driver options.</p>`
        : '<p>No test images are available on this server yet.</p>'
    }
    </main></div><script>
      const button=document.getElementById('print'),status=document.getElementById('status');
      Promise.all(Array.from(document.images,img=>img.decode())).then(()=>{if(!document.images.length){status.textContent='No test images available';return;}button.disabled=false;status.textContent='Ready · 1 printed side';}).catch(()=>{status.textContent='An image could not load. Reload to retry before printing.';});
      button.addEventListener('click',()=>window.print());
    </script></body></html>`;
}
