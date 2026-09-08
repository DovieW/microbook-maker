"""Independent EPUB-spine and PDF-text audits, using stdlib XML/ZIP and Poppler."""
import argparse
import json
import math
import pathlib
import posixpath
import re
import subprocess
import unicodedata
import urllib.parse
import xml.etree.ElementTree as ET
import zipfile


def normalized(text):
    return re.sub(r'[\s\u00ad\u202a-\u202e\u2066-\u2069]', '', unicodedata.normalize('NFC', text))


def tag(node):
    return node.tag.split('}')[-1] if isinstance(node.tag, str) else ''


def visible(node):
    if tag(node) in ('style', 'script', 'head', 'svg', 'noscript'):
        return ''
    return (node.text or '') + ''.join(visible(child) + (child.tail or '') for child in node)


def block_text(block):
    if block['kind'] == 'table':
        return ''.join(''.join(''.join(i['text'] for i in cell) for cell in row) for row in block.get('rows', []))
    return ''.join(i['text'] for i in block.get('inlines', []))


def audit_source(source, document):
    with zipfile.ZipFile(source) as archive:
        container = ET.fromstring(archive.read('META-INF/container.xml'))
        package_path = next(n.attrib['full-path'] for n in container.iter() if tag(n) == 'rootfile')
        package = ET.fromstring(archive.read(package_path))
        manifest = {n.attrib['id']: n.attrib['href'] for n in package.iter() if tag(n) == 'item'}
        texts = []
        for ref in (n for n in package.iter() if tag(n) == 'itemref'):
            resource = posixpath.normpath(posixpath.join(posixpath.dirname(package_path), urllib.parse.unquote(manifest[ref.attrib['idref']]).split('#')[0]))
            tree = ET.fromstring(archive.read(resource))
            body = next(n for n in tree.iter() if tag(n) == 'body')
            texts.append(visible(body))
    expected = normalized(''.join(texts))
    actual = normalized(''.join(block_text(block) for block in document['blocks']))
    if expected != actual:
        raise AssertionError(f'Spine content differs: source {len(expected)}, imported {len(actual)} characters')
    return {'complete': True, 'characters': len(expected)}


def audit_pdf(pdf, document, settings, metadata, cells):
    text = subprocess.check_output(['pdftotext', '-raw', str(pdf), '-']).decode('utf-8')
    selected = settings.get('selectedSections')
    blocks = [b for b in document['blocks'] if not selected or b['sectionId'] in selected]
    order = list(dict.fromkeys(settings.get('sectionOrder', []) + [s['id'] for s in document['sections']]))
    rank = {id: index for index, id in enumerate(order)}
    blocks.sort(key=lambda b: rank.get(b['sectionId'], len(rank)))
    excluded = {b['id'] for b in blocks if b['kind'] == 'image' and not b.get('imageHeading') and b['id'] in settings.get('excludedImageIds', [])}
    blocks = [b for b in blocks if b['id'] not in excluded and b.get('captionFor') not in excluded]
    def reading_text(block):
        if block.get('imageHeading'):
            return block['imageHeading']
        if block['kind'] == 'table':
            return '\n'.join(' '.join(''.join(i['text'] for i in cell) for cell in row) for row in block.get('rows', []))
        return block_text(block)

    words = len('\n\n'.join(reading_text(b) for b in blocks).split())
    minutes = math.ceil(words / 215)
    info = subprocess.check_output(['pdfinfo', str(pdf)]).decode('utf-8')
    pages = int(re.search(r'^Pages:\s+(\d+)', info, re.M)[1])
    position_count = 0
    if settings.get('positionHeaders', False):
        # Read text in PDF drawing order, and validate generated markers in their actual
        # cell rectangles. Never strip matching numbers/percentages from the book itself.
        tree = ET.fromstring(subprocess.check_output(['pdftotext', '-raw', '-bbox', str(pdf), '-']))
        def reading_length(value):
            value = re.sub(r'\s', '', unicodedata.normalize('NFC', value).replace('\u00ad', ''))
            return len(value.encode('utf-16-le')) // 2
        total = sum(reading_length(reading_text(b)) for b in blocks)
        offset = 0
        raw = normalized(text)
        character_offset = 0
        marker_ranges = []
        for page_index, page in enumerate(n for n in tree.iter() if tag(n) == 'page'):
            page_cells = [c for c in cells if c['page'] == page_index]
            marker_cells = [c for c in page_cells if c['index'] > 0 and c['index'] % 4 == 0 and not c.get('blank')]
            marker_words = {c['index']: [] for c in marker_cells}
            for word in (n for n in page.iter() if tag(n) == 'word'):
                x = (float(word.attrib['xMin']) + float(word.attrib['xMax'])) / 2
                y = (float(word.attrib['yMin']) + float(word.attrib['yMax'])) / 2
                found = None
                for cell in marker_cells:
                    slot = cell['index'] % 16
                    top = cell['y'] + (0.75 * ((4 if settings.get('foldGaps') else 0) + (1 if settings['borderStyle'] != 'none' else 0)) if slot >= 4 else 0)
                    # The inline marker reserves 10em (capped at 45% of the flow), not a whole line.
                    marker_right = cell['x'] + 1.5 + min(settings['fontSizePx'] * 7.5, (cell['width'] - 3) * .45)
                    if cell['x'] <= x < marker_right and top <= y < top + settings['fontSizePx'] * settings.get('lineHeight', 1) * 0.75:
                        found = cell['index']
                        break
                value = normalized(word.text or '')
                if found is not None:
                    marker_words[found].append(word.text or '')
                    # Bbox uses visual order within RTL words; raw preserves their
                    # logical reading order. Locate ASCII markers by verified drawing
                    # offsets, but retain raw source text (including all RTL runs).
                    if raw[character_offset:character_offset+len(value)] != value:
                        raise AssertionError('Position-header drawing and text offsets differ')
                    marker_ranges.append((character_offset, character_offset+len(value)))
                character_offset += len(value)
            for cell in page_cells:
                if cell['index'] == 0 or cell['index'] % 4 != 0 or cell.get('blank'):
                    offset += reading_length(cell['text'])
                    continue
                percent = math.floor(offset / total * 100) if total else 0
                expected_marker = f'{page_index//2+1}{"b" if page_index%2 else "a"} / {math.ceil(pages/2)} · {percent}%'
                actual_marker = ''.join(marker_words[cell['index']])
                if normalized(actual_marker) != normalized(expected_marker):
                    raise AssertionError(f'Cell {cell["index"]+1} position header: {actual_marker!r}, expected {expected_marker!r}')
                offset += reading_length(cell['text'])
                position_count += 1
        if character_offset != len(raw):
            raise AssertionError('Raw and bounding-box PDF text lengths differ')
        remaining = []
        offset = 0
        for start, end in marker_ranges:
            remaining.append(raw[offset:start])
            offset = end
        remaining.append(raw[offset:])
        text = ''.join(remaining)
    header = (metadata['title'] + f'Sheets: {math.ceil(pages/2)}Words: {words:,}'
              + f'Read time: {minutes//60}h {minutes%60}mAuthor: {metadata.get("author") or "—"}'
              + f'Year: {metadata.get("year") or "—"}Text size: {settings["fontSizePx"]:g} px'
              + (f'Series: {metadata["series"]}' if metadata.get('series') else ''))
    expected = ''.join((b.get('pageLabel', '') if settings.get('sourcePageNumbers') else '') + b.get('listMarker', '') + reading_text(b) for b in blocks)
    # CSS list markers are presentation. Poppler can add bidi controls around RTL text.
    expected = normalized(expected).replace('•', '')
    actual = normalized(text).replace('•', '')
    normalized_header = normalized(header).replace('•', '')
    if actual.count(normalized_header) != 1:
        raise AssertionError('PDF must contain exactly one title/info panel with correct physical counts')
    # Artwork and its captions may precede the first ordinary text cell. Independently
    # validate the panel once, then check all source text in order regardless of its placement.
    actual = actual.replace(normalized_header, '', 1)
    if settings.get('paragraphStyle') == 'markers':
        expected = expected.replace('¶', '')
        actual = actual.replace('¶', '')
    if expected != actual:
        first = next((i for i, (a, b) in enumerate(zip(expected, actual)) if a != b), min(len(expected), len(actual)))
        raise AssertionError(f'PDF text differs at {first}: expected {expected[max(0,first-40):first+100]!r}, received {actual[max(0,first-40):first+100]!r} ({len(expected)}/{len(actual)} characters)')
    return {'complete': True, 'characters': len(expected), 'positionHeaders': position_count}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--document', required=True)
    parser.add_argument('--source')
    parser.add_argument('--pdf')
    parser.add_argument('--job')
    args = parser.parse_args()
    document = json.loads(pathlib.Path(args.document).read_text())
    result = {}
    if args.source:
        result['spine'] = audit_source(args.source, document)
    if args.pdf:
        job = json.loads(pathlib.Path(args.job).read_text())
        result['pdf'] = audit_pdf(args.pdf, document, job['settings'], job['metadata'], job['result']['cells'])
    print(json.dumps(result))
