"""Check actual PDF text colors, exempting text contained in original illustration regions."""
import json
import subprocess
import sys
import xml.etree.ElementTree as ET

pdf, job_path = sys.argv[1:]
job = json.load(open(job_path))
xml = subprocess.check_output(['pdftohtml', '-xml', '-hidden', '-i', '-zoom', '1', '-stdout', pdf], stderr=subprocess.DEVNULL)
root = ET.fromstring(xml)
fonts = {}
checked = 0
image_text = 0
for page in root.findall('page'):
    page_index = int(page.attrib['number']) - 1
    fonts.update({font.attrib['id']: font.attrib.get('color', '').lower() for font in page.findall('fontspec')})
    regions = [region for region in job['result'].get('imageRegions', []) if region['page'] == page_index]
    for text in page.findall('text'):
        if not ''.join(text.itertext()).strip():
            continue
        color = fonts[text.attrib['font']]
        if color == '#000000':
            checked += 1
            continue
        x, y, w, h = [float(text.attrib[key]) for key in ['left', 'top', 'width', 'height']]
        if any(r['x'] - 1 <= x and r['y'] - 1 <= y and x + w <= r['x'] + r['width'] + 1 and y + h <= r['y'] + r['height'] + 1 for r in regions):
            image_text += 1
            continue
        raise AssertionError(f'Non-black generated PDF text on side {page_index + 1}: {color}, {"".join(text.itertext())[:60]!r}')
if not checked:
    raise AssertionError('No generated black text was found in the PDF')
print(json.dumps({'generatedTextBlack': True, 'textRuns': checked, 'imageTextRuns': image_text}))
