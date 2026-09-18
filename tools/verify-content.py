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


def matches_ellipsized(actual, expected):
    if actual == expected:
        return True
    if '…' not in actual:
        return False
    cursor = 0
    for part in actual.split('…'):
        found = expected.find(part, cursor)
        if found < 0:
            return False
        cursor = found + len(part)
    return True


def opening_headers(text, title, byline, stats):
    """Match the separate, single-line header fields; counts must remain exact."""
    lines = [normalized(line).replace('•', '') for line in text.splitlines() if normalized(line)]
    fields = [normalized(value).replace('•', '') for value in [title, byline, stats] if value]
    matches = set()
    for start in range(len(lines) - len(fields) + 1):
        candidate = lines[start:start + len(fields)]
        stats_match = candidate[-1] == fields[-1] or re.fullmatch(
            re.escape(fields[-1]) + r'·Printed(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\d{1,2},\d{4}',
            candidate[-1],
        )
        if not stats_match:
            continue
        if all(actual == expected or (
                actual.endswith('…') and len(actual) > 1 and expected.startswith(actual[:-1]))
                for actual, expected in zip(candidate[:-1], fields[:-1])):
            matches.add(''.join(candidate))
    return matches


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


def audit_pdf(pdf, document, settings, metadata, cells, rendered_word_count=None):
    text = subprocess.check_output(['pdftotext', '-raw', str(pdf), '-']).decode('utf-8')
    raw_text = text
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
    header_words = rendered_word_count or words
    header_minutes = math.ceil(header_words / 215)
    info = subprocess.check_output(['pdfinfo', str(pdf)]).decode('utf-8')
    pages = int(re.search(r'^Pages:\s+(\d+)', info, re.M)[1])
    position_count = 0
    rich = settings.get('rich', {})
    sheet_headers = rich.get('sheetHeaders', 'every')
    if settings.get('positionHeaders', False) or sheet_headers == 'every':
        # Read text in PDF drawing order, and validate generated headers in their actual
        # rectangles. Never strip matching titles, numbers, or percentages from the book itself.
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
            sheet_cells = ([c for c in page_cells if c['index'] > 0 and c['index'] % 32 == 0 and not c.get('blank')]
                           if sheet_headers == 'every' else [])
            marker_cells = ([c for c in page_cells
                             if c['index'] > 0 and c['index'] % 4 == 0 and not c.get('blank')
                             and c not in sheet_cells] if settings.get('positionHeaders', False) else [])
            generated_cells = marker_cells + sheet_cells
            generated_words = {c['index']: [] for c in generated_cells}
            for word in (n for n in page.iter() if tag(n) == 'word'):
                x = (float(word.attrib['xMin']) + float(word.attrib['xMax'])) / 2
                y = (float(word.attrib['yMin']) + float(word.attrib['yMax'])) / 2
                found = None
                for cell in generated_cells:
                    slot = cell.get('slot', cell['index'] % 16)
                    row = slot // 4
                    every_row = settings.get('foldGapEveryRow', True)
                    top_gap = every_row and row > 0 or not every_row and row == 2
                    gap = settings.get('foldGapMm', 2.5) * 96 / 25.4 / 2 if settings.get('foldGaps') and top_gap else 0
                    border = 1 if row > 0 and settings['borderStyle'] != 'none' else 0
                    top = cell['y'] + 0.75 * (gap + border)
                    region = cell.get('sheetHeader') or cell.get('positionHeader', {'x':cell['x'], 'y':top, 'width':cell['width'], 'height':settings['fontSizePx']*.75})
                    if region['x'] <= x < region['x'] + region['width'] and region['y'] <= y < region['y'] + region['height']:
                        found = cell['index']
                        break
                value = normalized(word.text or '')
                if found is not None:
                    generated_words[found].append(word.text or '')
                    # Bbox uses visual order within RTL words; raw preserves their
                    # logical reading order. Locate ASCII markers by verified drawing
                    # offsets, but retain raw source text (including all RTL runs).
                    if raw[character_offset:character_offset+len(value)] != value:
                        raise AssertionError('Position-header drawing and text offsets differ')
                    marker_ranges.append((character_offset, character_offset+len(value)))
                character_offset += len(value)
            for cell in page_cells:
                is_sheet_header = cell in sheet_cells
                is_position_header = cell in marker_cells
                if not is_sheet_header and not is_position_header:
                    offset += reading_length(cell['text'])
                    continue
                percent = math.floor(offset / total * 100) if total else 0
                if is_sheet_header:
                    remaining = math.ceil(header_minutes * max(0, total - offset) / total) if total else 0
                    def duration(value):
                        hours, remainder = divmod(value, 60)
                        return f'{hours}h' + (f' {remainder}m' if remainder else '') if hours else f'{remainder}m'
                    status = f'about {duration(remaining)} left' if remaining else 'complete'
                    expected_header = cell.get('sheetLabel') or (
                        metadata['title'] + f'{page_index//2+1} / {math.ceil(pages/2)}'
                        + (metadata.get('author') or 'MicroBook') + ' · '
                        + f'{percent}% complete · ' + status)
                    actual_header = ''.join(generated_words[cell['index']])
                    normalized_actual = normalized(actual_header)
                    normalized_expected = normalized(expected_header)
                    valid = matches_ellipsized(normalized_actual, normalized_expected)
                    if not valid:
                        raise AssertionError(f'Cell {cell["index"]+1} sheet header: {actual_header!r}, expected {expected_header!r}')
                else:
                    expected_marker = cell.get('positionLabel') or f'{page_index//2+1}{"b" if page_index%2 else "a"} / {math.ceil(pages/2)} · {percent}%'
                    actual_marker = ''.join(generated_words[cell['index']])
                    normalized_actual = normalized(actual_marker)
                    normalized_expected = normalized(expected_marker)
                    valid = matches_ellipsized(normalized_actual, normalized_expected)
                    if not valid:
                        raise AssertionError(f'Cell {cell["index"]+1} position header: {actual_marker!r}, expected {expected_marker!r}')
                    position_count += 1
                offset += reading_length(cell['text'])
        if character_offset != len(raw):
            raise AssertionError('Raw and bounding-box PDF text lengths differ')
        remaining = []
        offset = 0
        for start, end in marker_ranges:
            remaining.append(raw[offset:start])
            offset = end
        remaining.append(raw[offset:])
        text = ''.join(remaining)
    def duration(value):
        hours, remainder = divmod(value, 60)
        return f'{hours}h' + (f' {remainder}m' if remainder else '') if hours else f'{remainder}m'
    byline = ' · '.join(str(value) for value in
                        [metadata.get('author'), metadata.get('year'), metadata.get('series')] if value)
    stats = f'{math.ceil(pages/2)} sheets · {header_words:,} words · about {duration(header_minutes)}'
    # The cell map is the renderer's physical text contract. It includes generated
    # contents, detected image headings, section reordering, and source-page labels.
    # Source-to-document fidelity is checked separately by audit_source.
    expected = ''.join(cell.get('printedText', cell['text']) for cell in cells)
    # CSS list markers are presentation. Poppler can add bidi controls around RTL text.
    expected = normalized(expected).replace('•', '')
    actual = normalized(text).replace('•', '')
    headers = opening_headers(raw_text, metadata['title'], byline, stats)
    header_count = sum(actual.count(header) for header in headers)
    if sheet_headers == 'off':
        if header_count:
            raise AssertionError('PDF contains a title/info panel while sheet headers are off')
    else:
        if header_count != 1:
            raise AssertionError('PDF must contain exactly one opening title/info panel with correct physical counts')
        # Artwork and its captions may precede the first ordinary text cell. Independently
        # validate the panel once, then check all source text in order regardless of its placement.
        header = next(header for header in headers if header in actual)
        actual = actual.replace(header, '', 1)
    if settings.get('paragraphStyle') == 'markers':
        expected = expected.replace('¶', '')
        actual = actual.replace('¶', '')
    if not matches_ellipsized(actual, expected):
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
        result['pdf'] = audit_pdf(args.pdf, document, job['settings'], job['metadata'],
                                  job['result']['cells'], job['result'].get('wordCount'))
    print(json.dumps(result))
