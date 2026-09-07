# Image output and test printing

Images → Defaults offers Original color, Grayscale, and Laser optimized. Laser has Gentle (default), Standard, and Strong contrast. New books start with Laser optimized and Gentle contrast, regardless of the previous book’s choices. Existing books retain their settings. Existing drafts, old render records and kept versions retain original color when the setting is absent. Per-image output can override the book default or reset to “Use book setting”; overrides never carry into another book.

The enlarged image dialog compares original and processed pixels without navigating the PDF. Its processed image uses the same server endpoint as the compositor. Apply remains shared with all print/metadata settings. The PDF and its locations remain unchanged until a successful Apply; an image output change still requires PDF generation, but unchanged image processing is reused.

## Processing

Sharp converts to continuous grayscale on white, preserving source raster resolution. Laser mode applies fixed contrast about mid-gray: 1.04 / 1.10 / 1.18. No thresholding, dithering, resizing of raster inputs, or sharpening is applied. Stronger contrast can clip pale lines and deep shadows; the physical test sheet should guide the user's choice. The driver performs halftoning. Generated text is unaffected and remains vector black text.

SVG input in a processed mode is rasterized at up to 576 dpi in integer scale steps, bounded by the 40-megapixel decoder limit. Original output preserves the original asset bytes and the existing vector setting. Integer steps avoid fractional pixel rounding of small flourishes. Original assets are never overwritten.

`generated/image-cache` holds content-addressed PNGs keyed by original bytes, effective output/strength, algorithm version and Sharp versions. Concurrent requests share work and only two transforms run at once. Cache hits survive process restart and book/layout changes. Cache entries are derived data and can be removed when the server is stopped; the next request recreates them. Layout settings and document IDs are deliberately absent from the key. Algorithm changes must bump `IMAGE_OUTPUT_VERSION`.

## Permanent comparison sheet

Images → Test print opens `/api/image-test-print` in a separate tab. It displays five identical-size columns (Original, Grayscale, Gentle, Standard, Strong) and enables its Print button only after all images decode. The browser prints one Letter landscape side at actual size. It does not apply book drafts, create versions, or modify the current PDF.

The private server's selected cover and diagrams live in `uploads/print-samples`, independently of Library documents and cleanup. Preserve that directory in volume backups. No copyrighted sample bytes are shipped in Git. Provision a new server with explicitly selected local Library assets:

```
node tools/seed-image-test.mjs /path/to/uploads DOCUMENT_ID:a1 DOCUMENT_ID:a4 DOCUMENT_ID:a7
```

This copies at most three originals, records provenance, and refuses to replace an existing manifest. With no provisioned samples, the comparison page explains that none are available and disables printing. No document deletion can remove provisioned samples.

Physical Brother HL-L6200DW output still needs user comparison with Toner Save off. Screen preview and browser-generated PDFs cannot establish which contrast level is best for a particular paper/driver/printer combination.

Validation on the packaged application included the full technical book (162 rendered images, complete character coverage, zero overflows, Letter geometry and embedded text fonts), original/processed mobile comparison, and a one-side Letter landscape test PDF. A local benchmark of the three test images in four processed variants took 327 ms cold and 3 ms cached; these timings are illustrative, not a performance guarantee for other EPUBs.

## Reading the controls and comparison sheet

There are three **Image output** modes. Selecting **Laser optimized** reveals **Laser contrast**: Gentle, Standard or Strong, with a plain-language description of each. The comparison sheet groups those three levels under Laser optimized and prints the path **Images → Defaults → Image output**, followed by **Laser contrast** and **Apply**. Labels and level descriptions come from shared definitions.

**SVG rendering** is a separate collapsed compatibility control, shown only when the book has SVG artwork using Original color (including per-image overrides). It is hidden when no SVG can be affected; it is not an additional color or laser setting.

## Comparing one image

The enlarged preview fits inside the visible viewport, including its footer. Wide dialogs show Original color, Grayscale and Laser optimized together; medium dialogs show Original color beside the chosen processed version; phones show one selectable version. Laser contrast can be auditioned without editing the draft. “Use this version” stores the output for that image only, keeps the dialog open, and leaves the displayed PDF and reading position unchanged until Apply. Kept versions support comparison but cannot be edited. Fit and zoom work in each responsive layout.

Per-image orientation offers 90° left/right turns and reset. Rotation is separate from two-cell sheet placement and uses the rotated dimensions for fitting flourishes and illustrations. Original comparison images remain unchanged; processed comparisons and sidebar previews use the draft orientation. Apply updates the PDF. Matching artwork can receive the same orientation in one action. Rotation is cached without modifying source files and does not carry into newly imported books.
