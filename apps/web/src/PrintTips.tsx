import * as Dialog from '@radix-ui/react-dialog';
import { BookOpen, CircleHelp, ExternalLink, FileText, Printer, X } from 'lucide-react';
import { IconButton } from './ui';

const External = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a href={href} target="_blank" rel="noreferrer">
    {children}
    <ExternalLink size={14} aria-hidden="true" />
  </a>
);

export function PrintTips() {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button type="button" className="tips-action" aria-label="Tips" title="Print and folding tips">
          <CircleHelp size={17} aria-hidden="true" />
          <span>Tips</span>
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="tips-overlay" />
        <Dialog.Content className="tips-dialog" aria-describedby="print-tips-description">
          <header>
            <div>
              <Dialog.Title>Print &amp; fold tips</Dialog.Title>
              <Dialog.Description id="print-tips-description">
                A reliable starting point for a sharp, correctly aligned MicroBook.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <IconButton label="Close print tips">
                <X size={20} />
              </IconButton>
            </Dialog.Close>
          </header>

          <div className="tips-content">
            <aside className="tips-callout">
              <strong>Test one sheet first</strong>
              <span>
                Print sides 1–2, fold them, and check orientation and legibility before printing the whole
                book.
              </span>
            </aside>

            <section aria-labelledby="tips-paper">
              <div className="tips-section-heading">
                <FileText size={20} aria-hidden="true" />
                <div>
                  <h3 id="tips-paper">Paper</h3>
                  <p>Plain, uncoated US Letter paper folds cleanly and runs safely through laser printers.</p>
                </div>
              </div>
              <dl className="tips-facts">
                <div>
                  <dt>Best starting point</dt>
                  <dd>20 lb / 75–80 gsm white copy or multipurpose paper</dd>
                </div>
                <div>
                  <dt>Sharper, less show-through</dt>
                  <dd>24 lb / 90 gsm; expect a thicker folded book</dd>
                </div>
                <div>
                  <dt>Avoid</dt>
                  <dd>Coated, glossy, heavily textured, curled, or inkjet-only paper</dd>
                </div>
              </dl>
              <External href="https://support.brother.com/g/b/sp/faqend.aspx?c=us_ot&faqid=faq00000080_063&ftype3=2044&lang=en&prod=hll2460dw_us_as">
                Paper compatibility guidance
              </External>
            </section>

            <section aria-labelledby="tips-settings">
              <div className="tips-section-heading">
                <Printer size={20} aria-hidden="true" />
                <div>
                  <h3 id="tips-settings">Printer settings</h3>
                  <p>Let MicroBook handle the tiny-page layout. The print dialog should not rearrange it.</p>
                </div>
              </div>
              <ul className="tips-checklist">
                <li>
                  <strong>Paper:</strong> Letter, portrait
                </li>
                <li>
                  <strong>Scale:</strong> 100% or Actual size — never Fit or Shrink
                </li>
                <li>
                  <strong>Pages per sheet:</strong> 1 — MicroBook already places 16 cells on each side
                </li>
                <li>
                  <strong>Two-sided:</strong> Flip on long edge for portrait Letter
                </li>
                <li>
                  <strong>Quality:</strong> Best or 1200 dpi; turn Toner Save off for tiny type
                </li>
                <li>
                  <strong>Browser options:</strong> Turn headers and footers off
                </li>
              </ul>
              <p className="tips-note">
                If the back of the test sheet is upside down, use <strong>Flip on short edge</strong> instead;
                some printer drivers label the feed direction differently.
              </p>
            </section>

            <section aria-labelledby="tips-folding">
              <div className="tips-section-heading">
                <BookOpen size={20} aria-hidden="true" />
                <div>
                  <h3 id="tips-folding">Folding</h3>
                  <p>
                    Use the printed rules as crease guides and keep the edges square as layers accumulate.
                  </p>
                </div>
              </div>
              <ol className="tips-steps">
                <li>Place the sheet on a hard, flat surface and pre-crease each printed fold line.</li>
                <li>Make the parallel folds as an accordion, alternating toward and away from you.</li>
                <li>Collapse the cross-folds into a cell-sized packet, pressing each crease firmly.</li>
                <li>Stack the folded sheets in printed order and keep the covers on the outside.</li>
              </ol>
              <External href="https://www.youtube.com/watch?v=Q3jTZT2e8os">
                Watch a rectangular map-fold demonstration on YouTube
              </External>
            </section>

            <section aria-labelledby="tips-printer">
              <div className="tips-section-heading">
                <Printer size={20} aria-hidden="true" />
                <div>
                  <h3 id="tips-printer">What printer works best?</h3>
                  <p>
                    A monochrome laser printer gives tiny black text the cleanest, most economical result.
                  </p>
                </div>
              </div>
              <div className="tips-printer-card">
                <strong>Look for</strong>
                <span>Automatic duplex · true 1200 × 1200 dpi · Letter paper · 20–24 lb support</span>
              </div>
              <p className="tips-toner">
                <strong>Use the printer manufacturer’s genuine toner.</strong> It is the safest choice for
                consistent black density, crisp tiny type, and reliable fusing.
              </p>
              <p>
                A <strong>Brother HL-L2460DW</strong> is a good current example: compact, automatic duplex,
                and 1200 × 1200 dpi. You do not need this exact model; any reliable laser printer with those
                features should work well.
              </p>
              <External href="https://support.brother.com/g/s/id/htmldoc/printer/cv_hll2460dw/asoce/html/GUID-54D4812C-41E7-4CC4-BC10-F386912482D0_1.html">
                View the example printer specifications
              </External>
            </section>
          </div>

          <footer>
            <span>Keep the first test sheet as a reference for future books.</span>
            <Dialog.Close>Done</Dialog.Close>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
