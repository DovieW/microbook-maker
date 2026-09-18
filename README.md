# MicroBook

Turn a book into a few sheets of paper you can print and fold.

Open an EPUB, Markdown, or text file, adjust the layout, and preview the PDF before printing. MicroBook fits multiple small pages onto each sheet, with space around the folds.

[Try it online](https://microbook.dovieweinstock.workers.dev/) · [Sample PDF](samples/flatland-microbook.pdf) · [Self-hosting](#run-it-yourself)

![Flatland open in MicroBook, with layout controls beside the print preview](docs/images/workspace.png)

*Flatland by Edwin A. Abbott, from [Standard Ebooks](https://standardebooks.org/ebooks/edwin-a-abbott/flatland). [Sample settings and credits](samples/README.md).*

## Using MicroBook

1. **Open a book.** EPUB works best when you want to keep headings, illustrations, and notes.
2. **Choose a layout.** Basic keeps things simple. Rich gives you control over typography, headings, images, and navigation. Read across rows or by quadrant.
3. **Arrange the content.** Reorder or leave out sections and images, replace a cover, or add your own text and pictures.
4. **Apply and check.** Changes stay in draft until you apply them. Search the PDF or click a content item to jump to it.
5. **Print or download.** History keeps your books and layouts; save a named version when you want to keep an alternative.

You can also export layout settings, import them into another book, and keep your preferred settings in the browser.

## Printing

Print at **100% / actual size**, with the printer’s pages-per-sheet option set to **1**. MicroBook has already arranged the pages. Try one duplex sheet first to check orientation and folding before printing a whole book.

The type is small by design. Increase the text size if needed; the book will use more sheets. The app’s **Tips** button covers paper, printers, and folding. See the [print guide](docs/PRINT_REFINEMENTS.md) for more detail.

## Run it yourself

With Docker installed:

```sh
git clone https://github.com/DovieW/microbook-maker.git
cd microbook-maker
docker compose -f docker-compose.production.yml up --build -d
```

Open [localhost:7777](http://localhost:7777). Books and PDFs are stored in Docker volumes. Keep those volumes when upgrading; `docker compose down -v` deletes them.

A self-hosted instance has one shared library and no user accounts, so use it on your own machine or a trusted network. See [deployment and backups](DEPLOYMENT.md) for upgrades and remote access.

The [hosted Cloudflare beta](https://microbook.dovieweinstock.workers.dev/) keeps history in your browser, without a timed expiry. Clearing site data removes that history. PDF conversion runs on Cloudflare.

## Development

Node.js 24+ and Docker:

```sh
npm run mb -- setup
npm run mb -- dev --no-build
npm run mb -- check
npm run mb -- test --no-build --suite full
```

For native development, run `npm ci --ignore-scripts`, `npm run build`, and `npm run dev`. Chrome or Chromium must be installed; set `PUPPETEER_EXECUTABLE_PATH` if it isn’t found automatically.

[Architecture](docs/ARCHITECTURE.md) · [Rich EPUB support](docs/RICH_EPUB_FEATURES.md) · [Image output](docs/IMAGE_OUTPUT.md) · [Release notes](RELEASE_NOTES.md)

## License

MicroBook is licensed under [GPL-3.0](LICENSE). Books and artwork retain their own licenses. The Flatland sample is public domain in the United States; see its [source and attribution](samples/README.md). DRM-protected books aren’t supported.
