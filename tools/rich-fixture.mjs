import { syntheticEntries, xhtml, zip } from './fixtures.mjs';
export const richEntries = {
  ...syntheticEntries,
  'OEBPS/nav.xhtml': xhtml(
    '<nav epub:type="toc"><ol><li><a href="text/one.xhtml#chapter1">Chapter 1 First</a><ol><li><a href="text/one.xhtml#sub">A subsection</a></li></ol></li><li><a href="text/two.xhtml#chapter2">Chapter 2 Second</a></li></ol></nav><nav epub:type="page-list"><ol><li><a href="text/one.xhtml#page7">7</a></li></ol></nav>',
  ),
  'OEBPS/text/one.xhtml': xhtml(
    '<nav epub:type="toc"><h2>Publisher contents</h2><a href="#chapter1">First chapter</a></nav><h1 id="chapter1">Chapter 1 First</h1><p epub:type="epigraph">An opening quotation.</p><p id="page7">A source paragraph with <a href="https://example.com/articles?edition=1#details">a <em>useful</em> website</a> and a note<a epub:type="noteref" href="notes.xhtml#n1">[1]</a>. This paragraph is long enough to exercise a chapter opening drop cap without losing any source characters.</p><p>Repeat <a href="https://example.com/articles?edition=1#details">the same website</a> and <a href="two.xhtml#chapter2">the next chapter</a>.</p><section epub:type="z3998:poem"><p>First verse line<br/>Second verse line</p></section><h2 id="sub">A subsection</h2><figure><img src="../images/landscape.svg" alt="An original vector landscape"/><figcaption>A vector caption.</figcaption></figure>',
  ),
  'OEBPS/text/two.xhtml': xhtml(
    '<h1 id="chapter2">Chapter 2 Second</h1><p>Later prose refers to the same note<a epub:type="noteref" href="notes.xhtml#n1">[1]</a> and an <a href="https://example.org/">external destination</a>.</p><blockquote>An ordinary quotation.</blockquote><p>THE-END.</p>',
  ),
  'OEBPS/text/notes.xhtml': xhtml(
    '<aside epub:type="footnote" id="n1"><p>[1] NOTE-BODY: this note must occur once.</p><p>Its second paragraph is also preserved.</p></aside>',
  ),
};
export const richFixture = () => zip(richEntries);
