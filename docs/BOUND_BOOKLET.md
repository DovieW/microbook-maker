# Bound booklet printing

In Rich mode, select **Layout → Print format → Bound booklet**. The page width and height are measured in the existing Letter sheet's cells. One cell is 53.975 × 69.85 mm. An open book contains two pages, so the default is two cells side by side.

Each cut piece folds into four pages. Four nested pieces make a 16-page signature. Pieces per signature controls nesting and therefore page pairing; how many signatures you bind into one volume is an assembly choice.

Print the downloaded PDF at **actual size / 100%**, **portrait US Letter**, **double-sided, flip on long edge**. Solid lines are cuts; dashed lines are folds. Keep each front and back together. Group pieces by signature number, nest piece 1 outside piece 2, and continue inward. The final signature may be thinner. Page heights of three cells leave an unused strip on the sheet.

The Reading preview shows logical page order; Print sheets shows the duplex arrangement. Both come from the same pagination. All full-cell image layouts fit on one page here, while their original folded-sheet choices remain saved. The binding margin alternates at the inner edges. Assembly labels can be disabled independently of page numbers and guides.

For a physical check, run `npm run build` and `node tools/booklet-calibration.mjs` (set `PUPPETEER_EXECUTABLE_PATH` when Chromium is elsewhere). Print `output/pdf/booklet-calibration.pdf`, cut, fold, and nest. Its pages should read 1–32 upright in two 16-page signatures, with the signature and piece labels matching across both sides. This checks the printer's duplex setting before printing a book.

This version supports Rich only, Letter paper, rectangular pieces, and single-page pictures. Volume splitting, cross-gutter image spreads, and sewing simulation are not included.

The hosted Cloudflare edition pauses briefly between creating the printable PDF and the Reading PDF to respect the Free account’s request limit. Cancel remains available during that pause.
