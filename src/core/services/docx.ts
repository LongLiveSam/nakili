import { zipSync, type Zippable } from 'fflate';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Build a minimal, valid .docx (OOXML) from a title + paragraphs.
 * Zero dependencies beyond fflate for the zip container.
 */
export function buildDocxBlob(title: string, paragraphs: string[]): Blob {
  const body = paragraphs
    .map(
      (p) =>
        `<w:p><w:pPr><w:spacing w:after="200"/></w:pPr>${p
          .split('\n')
          .map(
            (line) =>
              `<w:r><w:t xml:space="preserve">${esc(line)}</w:t></w:r>`,
          )
          .join('<w:r><w:br/></w:r>')}</w:p>`,
    )
    .join('');

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:pPr><w:rPr><w:b/><w:sz w:val="40"/></w:rPr></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="40"/></w:rPr><w:t xml:space="preserve">${esc(title)}</w:t></w:r></w:p>
    ${body}
    <w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>
  </w:body>
</w:document>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const documentRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`;

  const files: Zippable = {
    '[Content_Types].xml': new TextEncoder().encode(contentTypes),
    '_rels/.rels': new TextEncoder().encode(rootRels),
    'word/document.xml': new TextEncoder().encode(documentXml),
    'word/_rels/document.xml.rels': new TextEncoder().encode(documentRels),
  };

  const zipped = zipSync(files);
  return new Blob([zipped], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}
